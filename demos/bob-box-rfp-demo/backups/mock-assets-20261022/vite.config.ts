import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const MAX_PPTX_BYTES = 50 * 1024 * 1024;

function boxSyncPlugin() {
  return {
    name: 'box-sync-api',
    configureServer(server) {
      server.middlewares.use('/api/export-to-box', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          // Read latest token from .env
          const envPath = path.resolve(__dirname, '.env');
          let token = '';
          if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            for (const line of content.split('\n')) {
              const trimmed = line.trim();
              if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [k, ...v] = trimmed.split('=');
                if (k.trim() === 'BOX_DEV_TOKEN') {
                  token = v.join('=').trim().replace(/^["']|["']$/g, '');
                }
              }
            }
          }

          if (!token) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: false,
              error: 'No BOX_DEV_TOKEN found in .env. Please refresh your 60-minute Box Developer Token.'
            }));
            return;
          }

          // Slide deck PPTX is rendered in the browser (identical to the website) and posted as the raw body
          const chunks: Buffer[] = [];
          let received = 0;
          for await (const chunk of req) {
            received += chunk.length;
            if (received > MAX_PPTX_BYTES) {
              res.statusCode = 413;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Slide deck payload too large' }));
              return;
            }
            chunks.push(chunk);
          }
          const pptxBuffer = chunks.length ? Buffer.concat(chunks) : undefined;

          // Import and run export script
          const { exportAssetsToBox } = await import('./scripts/export-assets-to-box.mjs');
          const results = await exportAssetsToBox(undefined, pptxBuffer);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            results
          }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: err.message || 'Export to Box failed'
          }));
        }
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), boxSyncPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false
  },
  preview: {
    host: '127.0.0.1',
    port: 4173
  }
});
