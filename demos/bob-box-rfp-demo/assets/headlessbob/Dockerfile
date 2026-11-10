FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
COPY browser ./browser
COPY public ./public
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git python3 tini \
    && rm -rf /var/lib/apt/lists/*
COPY vendor/bobshell-2.0.4.tgz /tmp/bobshell.tgz
RUN echo '10de047ffdc23a50f3e1ef69fad3b6313ff6dda0010589a22efe26b24685254b  /tmp/bobshell.tgz' | sha256sum -c - \
    && npm install --prefix /opt/bobshell /tmp/bobshell.tgz --omit=dev \
    && rm /tmp/bobshell.tgz \
    && printf '%s\n' '#!/bin/sh' 'exec env BOBSHELL_NO_RELAUNCH=true /usr/local/bin/node /opt/bobshell/node_modules/bobshell/dist/bob.js "$@"' > /usr/local/bin/bob \
    && chmod 0755 /usr/local/bin/bob
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY spec ./spec
COPY examples ./examples
COPY --from=build /app/public ./public
COPY scripts/container-entrypoint.sh /usr/local/bin/headlessbob-entrypoint
RUN chmod 0755 /usr/local/bin/headlessbob-entrypoint \
    && mkdir -p /data && chgrp -R 0 /data && chmod -R g=u /data
ENV NODE_ENV=production DATA_DIR=/data/service HOME=/data/home PORT=8000
USER 1001
EXPOSE 8000
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/headlessbob-entrypoint"]
CMD ["node", "dist/server.js"]
