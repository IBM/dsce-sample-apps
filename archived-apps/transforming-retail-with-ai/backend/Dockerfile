FROM node:20-alpine

WORKDIR /app

# Copy backend only
COPY package.json ./
COPY src ./src

RUN npm install --omit=dev

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/server.js"]

