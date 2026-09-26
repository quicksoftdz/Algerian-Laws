import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 8080);
const LMKIT_BASE_URL = (process.env.LMKIT_BASE_URL || 'http://127.0.0.1:5189/v1').replace(/\/+$/, '');
const LMKIT_API_KEY = process.env.LMKIT_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

app.use(express.json({ limit: '25mb' }));

function authHeaders(apiKey?: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

function lmkitEndpoint(pathname: string) {
  if (LMKIT_BASE_URL.endsWith('/v1')) return `${LMKIT_BASE_URL}${pathname}`;
  return `${LMKIT_BASE_URL}/v1${pathname}`;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'algerian-laws-ai' });
});

app.get('/api/ai/lmkit/models', async (_req, res) => {
  try {
    const response = await fetch(lmkitEndpoint('/models'), {
      headers: { Accept: 'application/json', ...authHeaders(LMKIT_API_KEY) },
    });
    const text = await response.text();
    if (!response.ok) return res.status(response.status).type('application/json').send(text);
    const data = JSON.parse(text);
    const models = Array.isArray(data?.data)
      ? data.data.map((m: any) => m.id || m.name).filter(Boolean)
      : [];
    res.json({ models });
  } catch (error: any) {
    res.status(502).json({ error: error?.message || 'Unable to reach LM-Kit One' });
  }
});

app.post('/api/ai/lmkit/test', async (_req, res) => {
  const started = Date.now();
  try {
    const response = await fetch(lmkitEndpoint('/models'), {
      headers: { Accept: 'application/json', ...authHeaders(LMKIT_API_KEY) },
    });
    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        message: `LM-Kit One returned HTTP ${response.status}`,
        latencyMs: Date.now() - started,
      });
    }
    const data = JSON.parse(text);
    const models = Array.isArray(data?.data)
      ? data.data.map((m: any) => m.id || m.name).filter(Boolean)
      : [];
    res.json({
      ok: true,
      message: `Connected to LM-Kit One in ${Date.now() - started}ms.`,
      detectedModels: models,
      latencyMs: Date.now() - started,
    });
  } catch (error: any) {
    res.status(502).json({
      ok: false,
      message: error?.message || 'Unable to reach LM-Kit One',
      latencyMs: Date.now() - started,
    });
  }
});

function toOpenAIContent(prompt: string, attachments: any[] = []) {
  const parts: any[] = [{ type: 'text', text: prompt }];
  for (const attachment of attachments) {
    if (attachment?.type === 'image' && typeof attachment.content === 'string' && attachment.content.startsWith('data:')) {
      const match = attachment.content.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        parts.push({ type: 'image_url', image_url: { url: attachment.content } });
      }
    }
  }
  return parts;
}

app.post('/api/ai/chat', async (req, res) => {
  const { prompt, model, systemPrompt, temperature = 0.7, attachments = [] } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const provider = model?.provider || '';
  try {
    if (provider === 'LM-Kit One') {
      const modelId = model?.customConfig?.modelId || model?.id || 'default';
      const response = await fetch(lmkitEndpoint('/chat/completions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(LMKIT_API_KEY) },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt || 'You are a helpful, precise AI assistant.' },
            { role: 'user', content: toOpenAIContent(prompt, attachments) },
          ],
          temperature,
          stream: false,
        }),
      });

      const text = await response.text();
      if (!response.ok) return res.status(response.status).type('application/json').send(text);

      const data = JSON.parse(text);
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('Unexpected LM-Kit One response.');
      return res.json({ text: content, provider: 'LM-Kit One', model: modelId });
    }

    if ((provider === 'Google' || !provider) && GEMINI_API_KEY) {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const contentParts: any[] = [{ text: prompt }];
      for (const attachment of attachments) {
        if (attachment?.type === 'image' && typeof attachment.content === 'string') {
          const match = attachment.content.match(/^data:([^;]+);base64,(.+)$/);
          if (match) contentParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
      }

      const result = await ai.models.generateContent({
        model: model?.id?.includes('pro') ? 'gemini-3.8-pro' : 'gemini-3.8-flash',
        contents: contentParts.length === 1 ? prompt : contentParts,
        config: systemPrompt ? { systemInstruction: systemPrompt, temperature } : { temperature },
      });

      return res.json({ text: result.text || '', provider: 'Google', model: model?.id });
    }

    return res.status(503).json({ error: 'No server-side AI provider is configured for the selected model.' });
  } catch (error: any) {
    console.error('AI request failed:', error);
    res.status(502).json({ error: error?.message || 'AI provider request failed.' });
  }
});

app.post('/api/ai/title', async (req, res) => {
  const { prompt, model } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'prompt is required' });

  try {
    if (model?.provider === 'LM-Kit One') {
      const modelId = model?.customConfig?.modelId || model?.id || 'default';
      const response = await fetch(lmkitEndpoint('/chat/completions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(LMKIT_API_KEY) },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: 'Generate strictly 3 to 5 words. No punctuation. Return only the title.' },
            { role: 'user', content: prompt.slice(0, 400) },
          ],
          temperature: 0.2,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(`LM-Kit One HTTP ${response.status}`);
      const data = await response.json();
      return res.json({ text: data?.choices?.[0]?.message?.content || '' });
    }

    if (GEMINI_API_KEY) {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const result = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Generate a concise 3-5 word title for this prompt. Return only the title words, no punctuation.\n\n${prompt.slice(0, 400)}`,
      });
      return res.json({ text: result.text || '' });
    }

    return res.status(503).json({ error: 'No title model is configured.' });
  } catch (error: any) {
    res.status(502).json({ error: error?.message || 'Title generation failed.' });
  }
});

const distDir = path.resolve(__dirname, 'dist');
app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Algerian Laws server listening on 0.0.0.0:${PORT}`);
});
