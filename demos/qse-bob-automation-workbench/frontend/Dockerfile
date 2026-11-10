# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/tsconfig.json frontend/vite.config.ts frontend/index.html ./
COPY frontend/public ./public
COPY frontend/src ./src
# Optional login-page prefill for local/demo images (empty by default; the values end up in the public bundle).
ARG VITE_DEFAULT_USERNAME=""
ARG VITE_DEFAULT_PASSWORD=""
RUN npx vite build

# Unprivileged NGINX (uid 101). Listens on 8080; the TLS override also listens on 8443.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Build context is the project root (docker-compose.yml: context ".."), which works with the classic builder too.
# The image entrypoint renders /etc/nginx/templates/*.template into /etc/nginx/conf.d with envsubst.
COPY deployment/nginx/default.conf.template /etc/nginx/templates/default.conf.template
ENV BACKEND_UPSTREAM=http://backend:8080
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080/nginx-health || exit 1
