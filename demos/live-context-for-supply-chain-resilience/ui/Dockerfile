# ui/Dockerfile
# Multi-stage production image for the Vite/React UI (Turnaround Supply Chain Intelligence)
# Target: IBM Cloud Code Engine
#
# Build args:
#   VITE_API_BASE_URL  – base URL the browser uses to reach the FastAPI backend
#                        e.g. https://backend-service.example.cloud.ibm.com
#                        Injected at BUILD time by Vite (VITE_ prefix).

# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer-cached unless package files change)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Optional: override the API base path baked into the bundle.
# WXO credentials are NOT build args — they live as Code Engine secrets on the backend.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy source and build
COPY index.html tsconfig.json vite.config.ts ./
COPY src/ ./src/
COPY images/ ./images/

RUN npm run build

# ── Stage 2: Production server (nginx) ───────────────────────────────────────
FROM nginx:1.27-alpine AS production

# envsubst (part of gettext) replaces $BACKEND_URL in the nginx config at startup.
RUN apk add --no-cache gettext

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our SPA-aware nginx config as a template; envsubst fills in $BACKEND_URL
# at container start time so the backend URL is a runtime env var, not baked in.
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy the built static assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx needs to write PID file and temp files; run as non-root via nginx user
# The official nginx:alpine image already ships with an "nginx" user (uid 101)
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/nginx-health || exit 1

# nginx:alpine's entrypoint automatically runs envsubst on /etc/nginx/templates/*.template
# and writes the result to /etc/nginx/conf.d/ before starting nginx.
CMD ["nginx", "-g", "daemon off;"]
