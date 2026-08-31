# ./frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy only manifests first for layer caching
COPY package*.json ./
RUN npm ci --include=dev || npm install

# Copy the rest
COPY . .

# Dev env
ENV HOST=0.0.0.0
ENV PORT=5173
ENV CHOKIDAR_USEPOLLING=true
# Optional: backend envs
ENV VITE_PUBLIC_API_URL=""
ENV VITE_API_TOKEN=""

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
