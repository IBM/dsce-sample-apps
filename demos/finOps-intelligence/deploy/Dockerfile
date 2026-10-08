# Multi-stage Dockerfile for Turbo Cloud Demo (IBM Cloudability + IBM Turbonomic FinOps App)
# Optimized for IBM Cloud Code Engine and production deployment

# Stage 1: Build the static assets
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install dependencies (ci for deterministic builds)
RUN npm ci

# Copy application source code and configuration files
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY src/ ./src/
COPY public/ ./public/

# Build static production bundle into /app/dist
RUN npm run build

# Stage 2: Serve static bundle using lightweight non-root Nginx
FROM nginxinc/nginx-unprivileged:alpine-slim AS runner

# Copy custom Nginx configuration optimized for SPA & Code Engine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose standard container port (Code Engine defaults or custom port 8080)
EXPOSE 8080

# Healthcheck for container runtime
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
