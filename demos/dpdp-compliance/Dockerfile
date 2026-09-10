# Stage 1: Build the React/Vite app
FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS builder

WORKDIR /app

# Copy dependency files and install
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with nginx on UBI9
FROM registry.access.redhat.com/ubi9/nginx-124:latest

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# IBM Code Engine runs containers as non-root (uid 1001)
# nginx-124 UBI image already handles this

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
