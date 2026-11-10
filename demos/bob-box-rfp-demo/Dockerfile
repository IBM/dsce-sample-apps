FROM registry.access.redhat.com/ubi9/nodejs-24:latest AS build
WORKDIR /opt/app-root/src
COPY --chown=1001:0 package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html postcss.config.js tailwind.config.js ./
RUN npm ci
COPY --chown=1001:0 src ./src
COPY --chown=1001:0 public ./public
RUN npm run build

FROM registry.access.redhat.com/ubi9/nodejs-24-minimal:latest
WORKDIR /opt/app-root/src
# vite preview serves the built UI and the /api routes defined in vite.config.ts,
# so the runtime image keeps node_modules and the scripts those routes import.
COPY --from=build --chown=1001:0 /opt/app-root/src/node_modules ./node_modules
COPY --from=build --chown=1001:0 /opt/app-root/src/dist ./dist
COPY --from=build --chown=1001:0 /opt/app-root/src/package.json /opt/app-root/src/vite.config.ts ./
COPY --chown=1001:0 scripts ./scripts
COPY --chown=1001:0 ["IBM Enterprise Content", "./IBM Enterprise Content"]
RUN chmod -R g=u "/opt/app-root/src/IBM Enterprise Content"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
USER 1001
EXPOSE 8080
CMD ["node", "node_modules/vite/bin/vite.js", "preview"]
