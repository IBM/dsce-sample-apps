###############################################
# Stage 1 — Build
###############################################
FROM node:20-alpine AS build

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build


###############################################
# Stage 2 — Runtime
###############################################
FROM nginx:1.27-alpine

RUN mkdir -p /tmp/nginx_temp \
    && mkdir -p /tmp/nginx \
    && chmod -R 777 /tmp \
    && chmod -R 777 /var/cache/nginx || true

COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

RUN chgrp -R 0 /etc/nginx /usr/share/nginx /var/cache/nginx /var/run \
    && chmod -R g+rwX /etc/nginx /usr/share/nginx /var/cache/nginx /var/run

EXPOSE 8080

USER 1001

CMD ["nginx", "-g", "daemon off;"]
