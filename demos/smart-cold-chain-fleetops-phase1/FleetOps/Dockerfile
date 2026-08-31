# FleetOps - IBM Carbon Design System Application
# Multi-stage Docker build for production deployment
# Builds for AMD64 (OpenShift) from M1 Mac

FROM --platform=linux/amd64 node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install since package-lock.json may not exist)
RUN npm install --only=production

# Copy application source
COPY . .

# Production stage
FROM --platform=linux/amd64 node:18-alpine

# Set working directory
WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY package*.json ./
COPY server.js ./
COPY public ./public

# Create non-root user first
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create data directory and set permissions
# chmod 777 is needed for OpenShift which runs containers with random UIDs
RUN mkdir -p /app/data && \
    chown -R nodejs:nodejs /app && \
    chmod -R 777 /app/data

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "server.js"]

# Made with Bob