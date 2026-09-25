// LM-Kit One API client utility
// Based on https://docs.lm-kit.com/lm-kit-one/api/index.html
// LM-Kit One serves models via OpenAI, Anthropic, Ollama, and native REST dialects.
// Default server port: 5189 (e.g. http://localhost:5189/v1)

export interface LMKitTestResult {
  ok: boolean;
  message: string;
  detectedModels?: string[];
  latencyMs?: number;
  serverInfo?: {
    version?: string;
    status?: string;
  };
}

export function normalizeLMKitBaseUrl(url: string, dialect: string = 'openai'): string {
  let clean = url.trim();
  // Remove trailing slashes
  clean = clean.replace(/\/+$/, '');

  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'http://' + clean;
  }

  // If dialect is OpenAI and URL does not end with /v1, add it if no other path exists
  if (dialect === 'openai') {
    try {
      const parsed = new URL(clean);
      if (parsed.pathname === '' || parsed.pathname === '/') {
        parsed.pathname = '/v1';
        return parsed.toString().replace(/\/+$/, '');
      }
    } catch {
      if (!clean.endsWith('/v1')) {
        clean = `${clean}/v1`;
      }
    }
  }

  return clean;
}

/**
 * Test connectivity with an LM-Kit One server and discover served models.
 */
export async function testLMKitConnection(
  baseUrl: string,
  apiKey?: string,
  dialect: 'openai' | 'anthropic' | 'ollama' | 'native' = 'openai'
): Promise<LMKitTestResult> {
  const normalized = normalizeLMKitBaseUrl(baseUrl, dialect);
  const startTime = Date.now();

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (apiKey?.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    if (dialect === 'anthropic') {
      headers['x-api-key'] = apiKey.trim();
      headers['anthropic-version'] = '2023-06-01';
    }
  }

  // Try standard /models endpoint (OpenAI dialect on LM-Kit One)
  const modelsEndpoint = normalized.endsWith('/v1')
    ? `${normalized}/models`
    : `${normalized}/v1/models`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(modelsEndpoint, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      let detectedModels: string[] = [];

      if (Array.isArray(data.data)) {
        detectedModels = data.data.map((m: any) => m.id || m.name).filter(Boolean);
      } else if (Array.isArray(data.models)) {
        detectedModels = data.models.map((m: any) => m.name || m.id).filter(Boolean);
      }

      return {
        ok: true,
        message: `Successfully connected to LM-Kit One in ${latencyMs}ms!`,
        detectedModels,
        latencyMs,
      };
    } else {
      // If /models returned 404 or auth required, check /health/live or /health/ready
      return {
        ok: false,
        message: `LM-Kit One server responded with status HTTP ${response.status}: ${response.statusText}`,
        latencyMs,
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    // Try secondary probe to health endpoint if host root is available
    try {
      const hostRoot = new URL(normalized).origin;
      const healthController = new AbortController();
      const healthTimeout = setTimeout(() => healthController.abort(), 3000);

      const healthRes = await fetch(`${hostRoot}/health/live`, {
        method: 'GET',
        signal: healthController.signal,
      }).catch(() => null);

      clearTimeout(healthTimeout);

      if (healthRes && (healthRes.ok || healthRes.status === 200)) {
        return {
          ok: true,
          message: `LM-Kit One server is running at ${hostRoot} (health check verified).`,
          latencyMs,
        };
      }
    } catch {
      // ignore secondary probe
    }

    if (err.name === 'AbortError') {
      return {
        ok: false,
        message: `Connection timed out after 7s. Please verify host and port (default is 5189).`,
        latencyMs,
      };
    }

    return {
      ok: false,
      message: `Failed to connect to ${normalized}: ${err.message || 'Network error'}. Check if LM-Kit One is running and CORS is permitted.`,
      latencyMs,
    };
  }
}

/**
 * Execute chat completion against LM-Kit One server
 */
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

  const normalized = normalizeLMKitBaseUrl(baseUrl, dialect);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey?.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    if (dialect === 'anthropic') {
      headers['x-api-key'] = apiKey.trim();
      headers['anthropic-version'] = '2023-06-01';
    }
  }

  // 1. OpenAI Dialect (Default and primary for LM-Kit One)
  if (dialect === 'openai') {
    const endpoint = normalized.endsWith('/v1')
      ? `${normalized}/chat/completions`
      : `${normalized}/v1/chat/completions`;

    const body = {
      model: modelId || 'default',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature,
      stream: false,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`LM-Kit One API error [HTTP ${res.status}]: ${errText || res.statusText}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      return content;
    }
    throw new Error('Received unexpected response structure from LM-Kit One server.');
  }

  // 2. Ollama Dialect
  if (dialect === 'ollama') {
    const hostRoot = new URL(normalized).origin;
    const endpoint = `${hostRoot}/api/chat`;

    const body = {
      model: modelId || 'default',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      stream: false,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`LM-Kit One (Ollama dialect) error: HTTP ${res.status}`);
    }

    const data = await res.json();
    return data?.message?.content || data?.response || '';
  }

  // 3. Anthropic Dialect
  if (dialect === 'anthropic') {
    const endpoint = normalized.endsWith('/v1')
      ? `${normalized}/messages`
      : `${normalized}/v1/messages`;

    const body = {
      model: modelId || 'default',
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`LM-Kit One (Anthropic dialect) error: HTTP ${res.status}`);
    }

    const data = await res.json();
    return data?.content?.[0]?.text || '';
  }

  throw new Error(`Unsupported dialect: ${dialect}`);
}
