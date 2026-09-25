# ---------- Stage 1: Build React frontend ----------
FROM node:18 AS frontend-build

WORKDIR /app/frontend

# Install frontend deps
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source and build
COPY frontend ./
RUN npm run build

# ---------- Stage 2: Production backend ----------
FROM node:18 AS production

WORKDIR /app

# Install backend deps (production only)
COPY backend/package*.json ./
RUN npm install --only=production

# Copy backend source (index.js, sample.csv, etc.)
COPY backend ./

# Copy React build into backend's public folder
COPY --from=frontend-build /app/frontend/build ./public

COPY frontend/public/drone_images ./public/drone_images

# Create directory for SSL certificates
RUN mkdir -p /app/certs

# Copy MongoDB CA certificate if it exists (optional for local dev)
# Place your certificate as 'backend/certs/mongodb-ca.crt' before building
# This will fail silently if the directory doesn't exist
RUN --mount=type=bind,source=backend/certs,target=/tmp/certs,readonly \
    cp -r /tmp/certs/* /app/certs/ 2>/dev/null || echo "No certificates to copy"

# Expose backend port (Code Engine default)
EXPOSE 8080

# Start backend
CMD ["node", "index.js"]