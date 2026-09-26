import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function lmkitDevGatewayPlugin(targetBaseUrl: string, apiKey: string): Plugin {
  return {
    name: 'lmkit-dev-gateway',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/lmkit')) {
          return next();
        }

        const normalizedBase = targetBaseUrl.replace(/\/+$/, '');
        const subPath = req.url.replace(/^\/api\/lmkit/, '') || '';
        const targetPath = subPath.startsWith('/v1')
          ? subPath
          : normalizedBase.endsWith('/v1')
          ? subPath
          : `/v1${subPath}`;
        const targetUrl = `${normalizedBase}${targetPath}`;

        const headers: Record<string, string> = {};
        if (req.headers['content-type']) {
          headers['Content-Type'] = String(req.headers['content-type']);
        }
        if (req.headers.accept) {
          headers['Accept'] = String(req.headers.accept);
        }
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        } else if (req.headers.authorization) {
          headers['Authorization'] = String(req.headers.authorization);
        }

        let body: Buffer | undefined;
        if (req.method && ['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          if (chunks.length > 0) {
            body = Buffer.concat(chunks);
          }
        }

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3000);

          const response = await fetch(targetUrl, {
            method: req.method || 'GET',
            headers,
            body: body ? new Uint8Array(body) : undefined,
            signal: controller.signal,
          });

          clearTimeout(timer);

          res.statusCode = response.status;
          response.headers.forEach((val, key) => {
            if (key.toLowerCase() !== 'content-encoding') {
              res.setHeader(key, val);
            }
          });

          const buffer = Buffer.from(await response.arrayBuffer());
          res.end(buffer);
        } catch (_err) {
          // Graceful fallback when local LM-Kit is offline, preventing Vite proxy ECONNREFUSED logs
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'LM-Kit gateway offline or unreachable',
              models: [],
            })
          );
        }
      });
    },
  };
}

export default defineConfig(() => {
  const lmkitBaseUrl = process.env.LMKIT_BASE_URL || 'http://127.0.0.1:5189';
  const lmkitApiKey = process.env.LMKIT_API_KEY || '';

  return {
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || ''),
    },
    plugins: [react(), tailwindcss(), lmkitDevGatewayPlugin(lmkitBaseUrl, lmkitApiKey)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
