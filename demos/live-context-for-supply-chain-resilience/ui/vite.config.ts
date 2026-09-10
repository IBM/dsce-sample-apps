import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // FastAPI backend — all /api/* calls go to the local backend in dev.
      // In production the nginx container proxies /api/* to the backend service.
      '/api': 'http://localhost:3001',
    },
  },
});
