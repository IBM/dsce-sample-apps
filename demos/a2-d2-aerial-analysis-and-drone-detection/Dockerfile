# ---------- Stage 1: Build React frontend ----------
FROM --platform=linux/amd64 node:18-slim AS frontend-build

WORKDIR /app/frontend

# Install frontend deps
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source and build
COPY frontend ./
RUN npm run build

# ---------- Stage 2: Production backend ----------
FROM --platform=linux/amd64 node:18-slim AS production

WORKDIR /app

# Install backend deps (production only)
COPY backend/package*.json ./
RUN npm install --only=production

# Copy backend source (index.js, demo-data, etc.)
COPY backend ./

# Copy React build into backend's public folder
COPY --from=frontend-build /app/frontend/build ./public

# Copy drone images into public directory
COPY frontend/public/drone_images ./public/drone_images

# Set default port for demo mode
ENV PORT=4000
EXPOSE 4000

# Start demo backend
CMD ["node", "index.js"]
