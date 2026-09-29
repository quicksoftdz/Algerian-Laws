import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  // ---------------------------------------------------------------------------
  // Environment
  // ---------------------------------------------------------------------------

  const gatewayBaseUrl =
    process.env.AI_GATEWAY_BASE_URL || 'http://127.0.0.1:3000';

  return {
    // -------------------------------------------------------------------------
    // Environment variables exposed to the client
    // -------------------------------------------------------------------------

    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(
        process.env.GEMINI_API_KEY || ''
      ),
    },

    // -------------------------------------------------------------------------
    // Plugins
    // -------------------------------------------------------------------------

    plugins: [react(), tailwindcss()],

    // -------------------------------------------------------------------------
    // Module resolution
    // -------------------------------------------------------------------------

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    // -------------------------------------------------------------------------
    // Development server
    // -------------------------------------------------------------------------

    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},

      // -----------------------------------------------------------------------
      // API Gateway Proxy
      //
      // IMPORTANT:
      // The browser must NOT call LM-Kit One (port 5189) directly.
      //
      // Browser :3001
      //     ↓
      // Vite /api/lmkit/*
      //     ↓
      // Node Gateway :3000
      //     ↓
      // LM-Kit One :5189
      //
      // Do NOT rewrite /api/lmkit.
      // The Node gateway expects these exact routes:
      //
      // GET  /api/lmkit/models
      // POST /api/lmkit/chat
      // -----------------------------------------------------------------------

      proxy: {
        '/api/lmkit': {
          target: gatewayBaseUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
