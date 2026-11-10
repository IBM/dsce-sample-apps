/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  css: { preprocessorOptions: { scss: { quietDeps: true } } },
  server: { port: 5173, proxy: { '/api': { target: process.env.VITE_API_PROXY ?? 'http://127.0.0.1:8080', changeOrigin: false } } },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 1500 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}']
  }
});
