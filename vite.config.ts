import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const lmkitBaseUrl = process.env.LMKIT_BASE_URL || 'http://127.0.0.1:5189';
  const lmkitApiKey = process.env.LMKIT_API_KEY || '';

  return {
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || ''),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/lmkit': {
          target: lmkitBaseUrl,
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api\/lmkit/, '/v1'),
          ...(lmkitApiKey
            ? { headers: { Authorization: 'Bearer ' + lmkitApiKey } }
            : {}),
        },
      },
    },
  };
});
