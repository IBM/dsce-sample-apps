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
      proxy: {
        '/api': {
          target: env.VITE_MCP_SERVER_URL || 'http://localhost:6868',
          changeOrigin: true,
          secure: false,
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
          rewrite: (path) => path.replace(/^\/ingest-api/, ''),
        },
        // Proxy OpenSearch requests so the browser never has to trust the
        // self-signed cert from the local Podman container.
        '/opensearch-api': {
          target: env.VITE_OPENSEARCH_URL || 'https://localhost:9200',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/opensearch-api/, ''),
        },
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
      // OpenSearch — use the /opensearch-api proxy prefix in dev so the
      // browser never has to handle the self-signed certificate from the
      // local Podman container.  In production set VITE_OPENSEARCH_URL to
      // the real cluster URL (or keep empty to skip direct UI health checks).
      'import.meta.env.VITE_OPENSEARCH_URL': JSON.stringify(
        env.VITE_OPENSEARCH_URL ? env.VITE_OPENSEARCH_URL : '/opensearch-api'
      ),
      // Expose the OpenSearch credentials to the UI for the health-check button.
      // Reads OPENSEARCH_USERNAME / OPENSEARCH_PASSWORD from the root .env so
      // the password never needs to be hardcoded in source.
      'import.meta.env.VITE_OPENSEARCH_USERNAME': JSON.stringify(
        env.OPENSEARCH_USERNAME || 'admin'
      ),
      'import.meta.env.VITE_OPENSEARCH_PASSWORD': JSON.stringify(
        env.OPENSEARCH_PASSWORD || 'admin'
      ),
    },
  };
});
