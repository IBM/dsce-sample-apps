/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // NOTE: /api/poc-stages/:stageKey/run and /api/poc-stages/:stageKey/run/:runId
      // are handled by Next.js Route Handlers — they do NOT appear here.
      // NOTE: /api/chat/:runId and /api/chat-conv/:runId (GET poll) are also
      // Route Handlers for the same reason — bypasses the 30s http-proxy timeout.
      {
        source: '/api/config',
        destination: process.env.BACKEND_URL || 'http://localhost:3001/api/config',
      },
      {
        source: '/api/runs/:path*',
        destination: process.env.BACKEND_URL || 'http://localhost:3001/api/runs/:path*',
      },
      // POST /api/chat and POST /api/chat-conv — fire-and-return-runId (fast)
      {
        source: '/api/chat',
        destination: process.env.BACKEND_URL || 'http://localhost:3001/api/chat',
      },
      {
        source: '/api/chat-conv',
        destination: process.env.BACKEND_URL || 'http://localhost:3001/api/chat-conv',
      },
      {
        source: '/api/wxo-token',
        destination: process.env.BACKEND_URL || 'http://localhost:3001/api/wxo-token',
      },
      {
        source: '/health',
        destination: process.env.BACKEND_URL || 'http://localhost:3001/health',
      },
    ];
  },
};

module.exports = nextConfig;
