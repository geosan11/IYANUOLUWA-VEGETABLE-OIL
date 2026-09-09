import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server middleware to emulate Vercel Serverless Function /api/ai locally
const localApiDevPlugin = (): Plugin => ({
  name: 'local-api-dev-server',
  configureServer(server) {
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
              const { default: handler } = await import('./api/ai');

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
export default defineConfig({
  plugins: [react(), localApiDevPlugin()],
  server: {
    port: 3000,
    host: true
  }
});
