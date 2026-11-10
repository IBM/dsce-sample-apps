import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const MAX_EXPORT_BYTES = 100 * 1024 * 1024;
const MAX_CONTEXT_BODY_BYTES = 2 * 1024 * 1024;
const MAX_CONTEXT_DOCUMENTS = 60;
const MAX_GENERATE_BODY_BYTES = 6 * 1024 * 1024;
const MAX_GENERATE_PROMPT_CHARS = 6000;
const MAX_GENERATE_PREVIOUS_CHARS = 60_000;
const GENERATE_ARTIFACT_TYPES = ['rfp_response', 'presentation', 'response', 'deck', 'email', 'revision'];

function boxSyncPlugin() {
  const plugin = {
    name: 'box-sync-api',
    configureServer(server) {
      // Live Box read: returns IBM Enterprise Content files + text content fetched via the official Box MCP server
      server.middlewares.use('/api/box/documents', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        try {
          const { loadLiveBoxDocuments } = await import('./scripts/box-live-documents.mjs');
          const documents = await loadLiveBoxDocuments();
          res.statusCode = 200;
          res.end(JSON.stringify({ documents }));
        } catch (err) {
          console.error('Live Box read failed:', err instanceof Error ? err.message : err);
          const isAuth = err instanceof Error && err.constructor.name === 'BoxAuthError';
          res.statusCode = isAuth ? 401 : 502;
          res.end(JSON.stringify({
            error: isAuth
              ? 'Box token expired or missing. Paste a fresh BOX_DEV_TOKEN into .env.'
              : 'Could not read from Box.'
          }));
        }
      });

      // Headless Bob LLM integration endpoints
      server.middlewares.use('/api/headless-bob/status', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        try {
          const { checkHeadlessBobHealth } = await import('./scripts/headless-bob-client.mjs');
          const status = await checkHeadlessBobHealth();
          res.statusCode = 200;
          res.end(JSON.stringify(status));
        } catch (err) {
          res.statusCode = 200;
          res.end(JSON.stringify({ ok: false, error: 'Offline' }));
        }
      });

      server.middlewares.use('/api/headless-bob/analyze', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const rawBody = Buffer.concat(chunks).toString('utf8');
          const { prompt, documents } = JSON.parse(rawBody || '{}');

          let docs = documents;
          if (!docs || !docs.length) {
            // If documents were not passed in, load from Box MCP
            try {
              const { loadLiveBoxDocuments } = await import('./scripts/box-live-documents.mjs');
              docs = await loadLiveBoxDocuments();
            } catch {
              docs = [];
            }
          }

          const { analyzeBoxContextWithBob } = await import('./scripts/headless-bob-client.mjs');
          const result = await analyzeBoxContextWithBob(prompt, docs);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, result }));
        } catch (err) {
          console.error('Headless Bob analysis failed:', err?.message || err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: 'Headless Bob analysis failed'
          }));
        }
      });

      // Workspace Context tab extraction (company background / RFP requirements / gaps)
      server.middlewares.use('/api/headless-bob/context', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          let received = 0;
          for await (const chunk of req) {
            received += chunk.length;
            if (received > MAX_CONTEXT_BODY_BYTES) {
              res.statusCode = 413;
              res.end(JSON.stringify({ success: false, error: 'Request too large' }));
              return;
            }
            chunks.push(chunk);
          }

          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const input = Array.isArray(body?.documents) ? body.documents : null;
          const valid =
            input &&
            input.length > 0 &&
            input.length <= MAX_CONTEXT_DOCUMENTS &&
            input.every(
              (d: any) =>
                d &&
                typeof d.id === 'string' &&
                typeof d.name === 'string' &&
                typeof d.folderPath === 'string' &&
                typeof d.fullContent === 'string'
            );
          if (!valid) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
            return;
          }

          const { extractWorkspaceContextWithBob } = await import('./scripts/headless-bob-client.mjs');
          const result = await extractWorkspaceContextWithBob(input);

          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, result }));
        } catch (err) {
          console.error('Headless Bob context extraction failed:', err?.message || err);
          res.statusCode = err instanceof SyntaxError ? 400 : 502;
          res.end(JSON.stringify({ success: false, error: 'Context extraction failed' }));
        }
      });

      // Workspace artifact generation / revision (RFP response, presentation)
      server.middlewares.use('/api/headless-bob/generate', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          let received = 0;
          for await (const chunk of req) {
            received += chunk.length;
            if (received > MAX_GENERATE_BODY_BYTES) {
              res.statusCode = 413;
              res.end(JSON.stringify({ success: false, error: 'Request too large' }));
              return;
            }
            chunks.push(chunk);
          }

          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          let input = Array.isArray(body?.documents) && body.documents.length > 0 ? body.documents : null;
          const previous = body?.previous;

          if (!input || input.length === 0) {
            const { loadLiveBoxDocuments } = await import('./scripts/box-live-documents.mjs');
            const loaded = await loadLiveBoxDocuments();
            input = loaded.map((d: any, idx: number) => ({
              id: d.boxFileId || d.id || `doc-${idx}`,
              name: d.name || 'Untitled Document',
              folderPath: d.folderPath || d.category || 'IBM Enterprise Content',
              fullContent: d.content || d.fullContent || '',
            }));
          }

          const valid =
            GENERATE_ARTIFACT_TYPES.includes(body?.type) &&
            typeof body?.prompt === 'string' &&
            body.prompt.trim().length > 0 &&
            body.prompt.length <= MAX_GENERATE_PROMPT_CHARS &&
            Array.isArray(input) &&
            input.length > 0 &&
            (previous === undefined ||
              (previous &&
                typeof previous.content === 'string' &&
                previous.content.length <= MAX_GENERATE_PREVIOUS_CHARS &&
                Number.isInteger(previous.version))) &&
            (body.context === undefined || (body.context && typeof body.context === 'object'));
          if (!valid) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
            return;
          }

          const normalizedDocs = input.slice(0, MAX_CONTEXT_DOCUMENTS).map((d: any, idx: number) => ({
            id: String(d.id || d.boxFileId || `doc-${idx}`),
            name: String(d.name || ''),
            folderPath: String(d.folderPath || d.category || ''),
            fullContent: String(d.fullContent || d.content || ''),
          }));

          const { generateWorkspaceArtifactWithBob } = await import('./scripts/headless-bob-client.mjs');
          const result = await generateWorkspaceArtifactWithBob({
            type: body.type,
            prompt: body.prompt,
            documents: normalizedDocs,
            context: body.context,
            previous
          });

          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, result }));
        } catch (err) {
          console.error('Headless Bob artifact generation failed:', err?.message || err);
          res.statusCode = err instanceof SyntaxError ? 400 : 502;
          res.end(JSON.stringify({ success: false, error: 'Artifact generation failed' }));
        }
      });

      server.middlewares.use('/api/headless-bob/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const rawBody = Buffer.concat(chunks).toString('utf8');
          const { message, documents, history } = JSON.parse(rawBody || '{}');

          const { askBobQuestionWithContext } = await import('./scripts/headless-bob-client.mjs');
          const result = await askBobQuestionWithContext(message, documents || [], history || []);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, ...result }));
        } catch (err) {
          console.error('Headless Bob chat failed:', err?.message || err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: 'Headless Bob chat failed'
          }));
        }
      });

      server.middlewares.use('/api/export-to-box', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          // All deliverables are built in the browser from the live brief/plan/assets and posted as multipart form data
          const chunks: Buffer[] = [];
          let received = 0;
          for await (const chunk of req) {
            received += chunk.length;
            if (received > MAX_EXPORT_BYTES) {
              res.statusCode = 413;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Export payload too large' }));
              return;
            }
            chunks.push(chunk);
          }

          const contentType = String(req.headers['content-type'] || '');
          if (!contentType.startsWith('multipart/form-data')) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Expected multipart/form-data' }));
            return;
          }

          const form = await new Request('http://localhost/', {
            method: 'POST',
            headers: { 'content-type': contentType },
            body: Buffer.concat(chunks)
          }).formData();

          const files: Array<{ filename: string; buffer: Buffer }> = [];
          for (const entry of form.getAll('files')) {
            if (typeof entry === 'string') continue;
            files.push({ filename: entry.name, buffer: Buffer.from(await entry.arrayBuffer()) });
          }

          // Import and run export script (validates filenames, resolves the folder via MCP, uploads over REST)
          const { exportAssetsToBox } = await import('./scripts/export-assets-to-box.mjs');
          const results = await exportAssetsToBox(undefined, files);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            results
          }));
        } catch (err) {
          console.error('Export to Box failed:', err instanceof Error ? err.message : err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: 'Export to Box failed'
          }));
        }
      });
    }
  };
  // Serve the same API routes from `vite preview` for the containerized deployment.
  return { ...plugin, configurePreviewServer: plugin.configureServer };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), boxSyncPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5190,
    strictPort: true
  },
  preview: {
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT) || 4173,
    allowedHosts: ['.codeengine.appdomain.cloud']
  }
});
