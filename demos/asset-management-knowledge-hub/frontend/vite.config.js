import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// ── IBM Plex font dev-server plugin ──────────────────────────────────────────
// Carbon's SCSS uses `~@ibm/plex/...` URL syntax (a webpack tilde convention).
// Vite doesn't understand the leading `~`, so the dev server returns 404 for
// those font requests and the browser logs sanitizer warnings.
// This plugin intercepts `GET /~@ibm/plex/...` and streams the real file from
// node_modules so fonts load correctly in development without any config change.
function ibmPlexFontPlugin() {
  return {
    name: 'ibm-plex-font-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/~@ibm/plex/')) return next();
        const relative = req.url.replace('/~@ibm/plex/', '');
        const filePath = path.resolve(__dirname, 'node_modules/@ibm/plex', relative);
        if (!fs.existsSync(filePath)) return next();
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === '.woff2' ? 'font/woff2'
                   : ext === '.woff'  ? 'font/woff'
                   : ext === '.ttf'   ? 'font/ttf'
                   : 'application/octet-stream';
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load root .env (two levels above frontend/)
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');

  return {
    plugins: [react(), ibmPlexFontPlugin()],
    resolve: {
      alias: {
        // Resolve SCSS `~@ibm/plex` tilde imports to the actual node_modules path
        '~@ibm/plex': path.resolve(__dirname, 'node_modules/@ibm/plex'),
      },
    },
    server: {
      port: 3002,
      strictPort: false,
      // All /api/* requests go to the MCP server (6868).
      // All /ingest-api/* requests are stripped of the prefix and forwarded
      // to the ingestion pipeline (8080) — keeps everything same-origin in dev.
      // The backends require a shared API key. The dev proxy adds it so the
      // browser bundle never contains it (EventSource cannot set headers anyway).
      proxy: {
        '/api': {
          target: env.VITE_MCP_SERVER_URL || 'http://localhost:6868',
          changeOrigin: true,
          secure: false,
          headers: { 'X-API-Key': env.API_KEY || '' },
        },
        '/health': {
          target: env.VITE_MCP_SERVER_URL || 'http://localhost:6868',
          changeOrigin: true,
          secure: false,
        },
        '/ingest-api': {
          target: env.VITE_INGESTION_URL || 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
          // Local dev runs as the administrator, so the admin key is added too.
          headers: { 'X-API-Key': env.API_KEY || '', 'X-Admin-Key': env.ADMIN_API_KEY || '' },
          rewrite: (path) => path.replace(/^\/ingest-api/, ''),
        },
        // /whoami is answered by nginx in production; the dev server falls back
        // to a local user name in the app (see App.jsx), so nothing to proxy here.
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern',
          quietDeps: true,
        },
      },
    },
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      rollupOptions: {
        output: {
          manualChunks: {
            carbon: ['@carbon/react', '@carbon/icons-react'],
            vendor: ['react', 'react-dom', 'axios'],
          },
        },
      },
    },
    define: {
      // MCP server — always use relative path in dev so requests go through the
      // Vite proxy above (avoids CORS). In production, set VITE_MCP_SERVER_URL
      // to the deployed server URL; in development leave it empty.
      'import.meta.env.VITE_MCP_SERVER_URL': JSON.stringify(
        mode === 'production' ? (env.VITE_MCP_SERVER_URL || '') : ''
      ),
      // Ingestion pipeline — always use the /ingest-api proxy prefix in dev so
      // the browser never makes a direct cross-origin call to port 8080.
      // In production, set VITE_INGESTION_URL to the deployed service URL.
      'import.meta.env.VITE_INGESTION_URL': JSON.stringify(
        mode === 'production' ? (env.VITE_INGESTION_URL || '/ingest-api') : '/ingest-api'
      ),
      // Deliberately no OpenSearch URL or credentials here: anything defined in
      // this block is compiled into the public JavaScript bundle.
    },
  };
});
