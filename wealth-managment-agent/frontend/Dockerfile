# Step 1: Build the React app
FROM node:18-alpine AS build
# 

# Set the working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm cache clean --force
# RUN npm install --verbose
RUN npm install

# Copy the source files
COPY . .

# Build the React app
RUN npm run build

# Expose port 80
EXPOSE 8080

# Start Nginx
CMD ["npm", "run", "preview"]