// LM-Kit One client. Localhost requests use the same-origin server gateway.
// Production should keep LM-Kit credentials on the server.

import { ModelOption } from '../types/chat';

export interface LMKitTestResult {
  ok: boolean;
  message: string;
  detectedModels?: string[];
  latencyMs?: number;
}

const GATEWAY_PATH = '/api/lmkit';

/**
 * Robustly parses model ID strings from any LM-Kit or OpenAI gateway JSON response.
 * Handles array of strings, array of objects, { data: [...] }, and { models: [...] }.
 */
export function parseModelIdsFromGatewayResponse(data: any): string[] {
  if (!data) return [];

  // Direct array: ["qwen3.5:0.8b", ...] or [{ id: "qwen3.5:0.8b" }]
  if (Array.isArray(data)) {
    return data
      .map((item) => (typeof item === 'string' ? item : item?.id || item?.name))
      .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()));
  }

  // Standard OpenAI /v1/models format: { data: [...] }
  if (Array.isArray(data?.data)) {
    return data.data
      .map((item: any) => (typeof item === 'string' ? item : item?.id || item?.name))
      .filter((id: any): id is string => typeof id === 'string' && Boolean(id.trim()));
  }

  // Gateway format: { models: [...] }
  if (Array.isArray(data?.models)) {
    return data.models
      .map((item: any) => (typeof item === 'string' ? item : item?.name || item?.id))
      .filter((id: any): id is string => typeof id === 'string' && Boolean(id.trim()));
  }

  return [];
}

/**
 * Converts a raw model ID returned by the LM-Kit gateway into a complete ModelOption structure.
 * Does not hard-code model names.
 */
export function createLMKitModelOption(modelId: string): ModelOption {
  const cleanName = modelId.startsWith('lmkit/') ? modelId.replace(/^lmkit\//, '') : modelId;
  const canonicalId = modelId;

  return {
    id: canonicalId,
    name: cleanName,
    provider: 'LM-Kit One',
    description: `Private on-premise LM-Kit model: ${cleanName}`,
    contextWindow: '128k tokens',
    speed: 'Ultra-fast',
    isCustom: true,
    customConfig: {
      baseUrl: GATEWAY_PATH,
      modelId: cleanName,
      dialect: 'openai',
      port: 5189,
    },
  };
}

/**
 * Fetches available LM-Kit models from GET /api/lmkit/models.
 * Does not crash if the gateway is unavailable.
 */
export async function fetchAvailableLMKitModels(): Promise<string[]> {
  try {
    const response = await fetch(GATEWAY_PATH + '/models', {
      headers: { Accept: 'application/json' },
    });
    if (response.ok) {
      const data = await response.json();
      const detected = parseModelIdsFromGatewayResponse(data);
      if (detected.length > 0) return detected;
    }
  } catch {
    // ignore, fall through to fallback check
  }

  // Secondary fallback: in case the proxy/server mounts under /api/ai/lmkit/models
  try {
    const fallbackRes = await fetch('/api/ai/lmkit/models', {
      headers: { Accept: 'application/json' },
    });
    if (fallbackRes.ok) {
      const data = await fallbackRes.json();
      return parseModelIdsFromGatewayResponse(data);
    }
  } catch {
    // ignore
  }

  return [];
}

function useGateway(baseUrl: string): boolean {
  const value = baseUrl.trim().replace(/\/+$/, '');
  if (value === GATEWAY_PATH || value.startsWith(GATEWAY_PATH + '/')) return true;

  if (typeof window !== 'undefined') {
    try {
      const host = new URL(value).hostname;
      return host === 'localhost' || host === '127.0.0.1';
    } catch {
      return false;
    }
  }
  return false;
}

function normalizeLMKitBaseUrl(url: string, dialect = 'openai'): string {
  let clean = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(clean)) clean = 'http://' + clean;

  if (dialect === 'openai') {
    try {
      const parsed = new URL(clean);
      if (!parsed.pathname || parsed.pathname === '/') {
        parsed.pathname = '/v1';
        return parsed.toString().replace(/\/+$/, '');
      }
    } catch {
      if (!clean.endsWith('/v1')) clean += '/v1';
    }
  }
  return clean;
}

async function errorFromResponse(response: Response, prefix: string): Promise<Error> {
  const raw = await response.text().catch(() => '');
  let detail = raw || response.statusText;
  try {
    const json = JSON.parse(raw);
    detail = json?.error?.message || json?.message || json?.detail || detail;
  } catch {
    // Keep plain text.
  }
  return new Error(prefix + ' [HTTP ' + response.status + ']: ' + detail);
}

function modelIds(data: any): string[] {
  return parseModelIdsFromGatewayResponse(data);
}

export async function testLMKitConnection(
  baseUrl: string,
  apiKey?: string,
  dialect: 'openai' | 'anthropic' | 'ollama' | 'native' = 'openai'
): Promise<LMKitTestResult> {
  const started = Date.now();
  const gateway = useGateway(baseUrl);

  try {
    const endpoint = gateway
      ? GATEWAY_PATH + '/models'
      : (() => {
          const normalized = normalizeLMKitBaseUrl(baseUrl, dialect);
          return normalized.endsWith('/v1') ? normalized + '/models' : normalized + '/v1/models';
        })();

    const headers: Record<string, string> = { Accept: 'application/json' };
    // Never send the saved gateway secret from the browser.
    if (!gateway && apiKey?.trim()) headers.Authorization = 'Bearer ' + apiKey.trim();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(endpoint, { headers, signal: controller.signal });
      if (!response.ok) throw await errorFromResponse(response, 'LM-Kit connection failed');
      const data = await response.json();
      const detectedModels = modelIds(data);
      return {
        ok: true,
        message: (gateway ? 'LM-Kit One gateway connected in ' : 'LM-Kit One connected in ') + (Date.now() - started) + 'ms.',
        detectedModels,
        latencyMs: Date.now() - started,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err: any) {
    return {
      ok: false,
      message: err?.name === 'AbortError'
        ? 'LM-Kit connection timed out after 7s.'
        : (err?.message || 'Unable to connect to LM-Kit One.'),
      latencyMs: Date.now() - started,
    };
  }
}

export async function executeLMKitChatCompletion(options: {
  baseUrl: string;
  apiKey?: string;
  modelId: string;
  prompt: string;
  systemPrompt?: string;
  dialect?: 'openai' | 'anthropic' | 'ollama' | 'native';
  temperature?: number;
}): Promise<string> {
  const {
    baseUrl,
    apiKey,
    modelId,
    prompt,
    systemPrompt = 'You are a helpful, precise AI assistant.',
    dialect = 'openai',
    temperature = 0.7,
  } = options;

  if (useGateway(baseUrl)) {
    if (dialect !== 'openai') {
      throw new Error('The LM-Kit gateway currently uses the OpenAI-compatible dialect.');
    }

    const cleanModel = modelId.startsWith('lmkit/') ? modelId.replace(/^lmkit\//, '') : modelId;
    const finalModel = cleanModel === 'default' || cleanModel === 'local-model' ? '' : cleanModel;

    // First attempt standard OpenAI completions endpoint (/api/lmkit/chat/completions)
    try {
      const openAiRes = await fetch(GATEWAY_PATH + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: finalModel || 'default',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature,
          stream: false,
        }),
      });

      if (openAiRes.ok) {
        const data = await openAiRes.json();
        const content = data?.choices?.[0]?.message?.content ?? data?.text;
        if (typeof content === 'string') return content;
      }
    } catch {
      // Fall through to /api/lmkit/chat
    }

    const response = await fetch(GATEWAY_PATH + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: finalModel,
        prompt,
        systemPrompt,
        temperature,
      }),
    });

    if (!response.ok) throw await errorFromResponse(response, 'LM-Kit gateway error');
    const data = await response.json();
    if (typeof data?.text === 'string') return data.text;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content;
    throw new Error('LM-Kit gateway returned an unexpected response.');
  }

  const normalized = normalizeLMKitBaseUrl(baseUrl, dialect);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey?.trim()) headers.Authorization = 'Bearer ' + apiKey.trim();

  if (dialect === 'openai') {
    const endpoint = normalized.endsWith('/v1')
      ? normalized + '/chat/completions'
      : normalized + '/v1/chat/completions';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId || 'default',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature,
        stream: false,
      }),
    });

    if (!response.ok) throw await errorFromResponse(response, 'LM-Kit One API error');
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content;
    throw new Error('Received an unexpected LM-Kit response.');
  }

  if (dialect === 'ollama') {
    const endpoint = new URL(normalized).origin + '/api/chat';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId || 'default',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        stream: false,
      }),
    });
    if (!response.ok) throw await errorFromResponse(response, 'LM-Kit Ollama API error');
    const data = await response.json();
    return data?.message?.content || data?.response || '';
  }

  if (dialect === 'anthropic') {
    const endpoint = normalized.endsWith('/v1') ? normalized + '/messages' : normalized + '/v1/messages';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { ...headers, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: modelId || 'default',
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature,
      }),
    });
    if (!response.ok) throw await errorFromResponse(response, 'LM-Kit Anthropic API error');
    const data = await response.json();
    return data?.content?.[0]?.text || '';
  }

  throw new Error('Unsupported LM-Kit dialect: ' + dialect);
}
