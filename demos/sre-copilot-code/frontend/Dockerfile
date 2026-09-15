# ── Stage 1: Build the React app ─────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: Serve with Nginx (unprivileged — required for OpenShift) ─────────
# nginxinc/nginx-unprivileged listens on 8080, writes to /tmp, runs as uid 101.
FROM nginxinc/nginx-unprivileged:alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
