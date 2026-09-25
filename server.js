import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const lmkitBaseUrl = String(process.env.LMKIT_BASE_URL || 'http://127.0.0.1:5189').replace(/\/+$/, '');
const lmkitApiKey = String(process.env.LMKIT_API_KEY || '').trim();
const requestTimeoutMs = Number(process.env.LMKIT_TIMEOUT_MS || 120000);

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

function lmkitUrl(pathname) {
  return lmkitBaseUrl + pathname;
}

function upstreamHeaders() {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (lmkitApiKey) headers.Authorization = 'Bearer ' + lmkitApiKey;
  return headers;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readUpstreamError(response) {
  const text = await response.text().catch(() => '');
  let detail = text || response.statusText;
  try {
    const json = JSON.parse(text);
    detail = json?.error?.message || json?.message || json?.detail || detail;
  } catch {
    // Keep plain-text error details.
  }
  return detail;
}

function extractText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === 'string' ? part : (part?.text || '')).join('');
  }
  return data?.result || data?.text || '';
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'algerian-laws-ai-gateway' });
});

app.get('/api/lmkit/models', async (_req, res) => {
  try {
    const response = await fetchWithTimeout(lmkitUrl('/v1/models'), {
      method: 'GET',
      headers: upstreamHeaders(),
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: await readUpstreamError(response) });
    }
    return res.json(await response.json());
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'LM-Kit request timed out.' : (error?.message || 'Unable to reach LM-Kit One.');
    return res.status(502).json({ error: message });
  }
});

app.post('/api/lmkit/chat', async (req, res) => {
  const { model = '', prompt, systemPrompt = 'You are a helpful, precise AI assistant.', temperature = 0.7 } = req.body || {};

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'A non-empty prompt is required.' });
  }

  if (!Number.isFinite(Number(temperature))) {
    return res.status(400).json({ error: 'temperature must be a number.' });
  }

  const payload = {
    messages: [
      { role: 'system', content: String(systemPrompt || '') },
      { role: 'user', content: prompt },
    ],
    temperature: Math.min(2, Math.max(0, Number(temperature))),
    stream: false,
  };

  if (typeof model === 'string' && model.trim()) payload.model = model.trim();

  try {
    const response = await fetchWithTimeout(lmkitUrl('/v1/chat/completions'), {
      method: 'POST',
      headers: upstreamHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: await readUpstreamError(response) });
    }

    const data = await response.json();
    const text = extractText(data);
    if (!text) return res.status(502).json({ error: 'LM-Kit One returned no assistant text.' });

    return res.json({ text, model: data?.model || model || null, usage: data?.usage || null });
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'LM-Kit request timed out.' : (error?.message || 'Unable to reach LM-Kit One.');
    return res.status(502).json({ error: message });
  }
});

const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found.' });
  return res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log('Algerian Laws app + AI gateway listening on http://0.0.0.0:' + port);
  console.log('LM-Kit upstream: ' + lmkitBaseUrl);
});