import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Server-only keys that api/ai.ts reads from process.env.
 *
 * Vite exposes ONLY `VITE_*` variables to the browser and never copies a .env
 * file into this Node process's process.env. The emulated handler therefore saw
 * an empty `AI_PROXY_TOKEN`, answered 500 "AI proxy not configured", and the app
 * quietly fell back to the offline deterministic engine.
 */
const SERVER_ENV_KEYS = [
  'AI_PROXY_TOKEN',
  'ANTHROPIC_API_KEY',
  'CLAUDE_API_KEY',
  'AI_ALLOWED_ORIGINS'
];

// Dev server middleware to emulate Vercel Serverless Function /api/ai locally
const localApiDevPlugin = (mode: string): Plugin => ({
  name: 'local-api-dev-server',
  configureServer(server) {
    // loadEnv only READS the .env files; nothing lands in process.env unless we
    // put it there, so mirror just the server-side keys the handler needs.
    const fileEnv = loadEnv(mode, process.cwd(), '');
    for (const key of SERVER_ENV_KEYS) {
      if (fileEnv[key] !== undefined && process.env[key] === undefined) {
        process.env[key] = fileEnv[key];
      }
    }
    if (!process.env.AI_PROXY_TOKEN) {
      console.warn(
        '[dev /api/ai] AI_PROXY_TOKEN is not set in .env — /api/ai will answer 500 and the app will use the offline deterministic engine.'
      );
    }

    server.middlewares.use(async (req, res, next) => {
      if (req.url && req.url.startsWith('/api/ai')) {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Role');
          res.statusCode = 200;
          res.end();
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const { default: handler } = await server.ssrLoadModule('/api/ai.ts');

              const mockReq = {
                method: 'POST',
                headers: req.headers,
                body: parsed
              };

              const mockRes = {
                setHeader: (name: string, val: string) => res.setHeader(name, val),
                status: (code: number) => {
                  res.statusCode = code;
                  return mockRes;
                },
                json: (data: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                },
                end: () => res.end()
              };

              await handler(mockReq, mockRes);
            } catch (err: any) {
              // Never fail silently: without this the browser shows a bare 500
              // and nothing at all reaches this terminal.
              console.error('[dev /api/ai] handler failed:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'Server error' }));
            }
          });
          return;
        }
      }
      next();
    });
  }
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), localApiDevPlugin(mode)],
  server: {
    port: 3000,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'icons-vendor': ['@phosphor-icons/react']
        }
      }
    }
  }
}));
