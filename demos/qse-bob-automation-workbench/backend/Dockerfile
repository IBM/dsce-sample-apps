# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
# git: repository cloning (invoked with argument arrays, never through a shell)
# tini: PID 1 signal forwarding and zombie reaping for git child processes
# JAVA_PACKAGE: the QSE CLI is validated inside this container, so any runtime it needs must exist here.
#   Example: --build-arg JAVA_PACKAGE=default-jre-headless
ARG JAVA_PACKAGE=""
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates tini ${JAVA_PACKAGE} \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1001 workbench \
    && useradd --uid 1001 --gid 1001 --no-create-home --shell /usr/sbin/nologin workbench \
    && mkdir -p /data/db /data/workspaces \
    && chown -R 1001:1001 /data
WORKDIR /app
COPY --from=build --chown=1001:1001 /app/package.json ./
COPY --from=build --chown=1001:1001 /app/node_modules ./node_modules
COPY --from=build --chown=1001:1001 /app/dist ./dist
# Recorded real run replayed by STREAM_MODE=mock (unused in realtime).
COPY --chown=1001:1001 demo-data ./demo-data
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    HOME=/tmp \
    GIT_TERMINAL_PROMPT=0
USER 1001:1001
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
