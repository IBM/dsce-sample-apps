FROM node:16-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

RUN apk update && apk upgrade && \
    apk add --no-cache libssl3 libcrypto3 && \
    rm -rf /var/cache/apk/*
EXPOSE 3000
CMD ["npm", "start"]