# syntax=docker/dockerfile:1.6

############################
# 1) Build stage
############################
FROM node:20-alpine AS build

WORKDIR /app

# Optional: better Alpine compat for some native deps
RUN apk add --no-cache libc6-compat

# Copy only manifests first to maximize layer caching
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Allow build-time API URL injection for Vite (picked up at `npm run build`)
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Install deps using the right package manager
# - yarn.lock  -> yarn install --frozen-lockfile
# - package-lock.json -> npm ci
# - otherwise -> npm install
RUN corepack enable || true && \
    if [ -f yarn.lock ]; then \
        yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
        npm ci; \
    else \
        npm install; \
    fi

# Copy the rest of the source and build
COPY . .
RUN if [ -f yarn.lock ]; then \
        yarn build; \
    else \
        npm run build; \
    fi


############################
# 2) Runtime stage (Nginx)
############################
FROM nginx:1.27-alpine AS runtime

# Remove default site and add an SPA-friendly config with caching
RUN rm -f /etc/nginx/conf.d/default.conf
RUN <<'NGINXCONF' cat > /etc/nginx/conf.d/default.conf
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  # Gzip for text assets
  gzip on;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;

  # Single Page App routing: serve index.html for unknown routes
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Cache static assets aggressively
  location ~* \.(?:js|mjs|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000" always;
    try_files $uri =404;
  }

  # Never cache the HTML shell
  location = /index.html {
    add_header Cache-Control "no-store" always;
  }
}
NGINXCONF

# Copy built app
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
