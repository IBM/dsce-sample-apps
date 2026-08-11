FROM registry.access.redhat.com/ubi9/nodejs-20 AS build

WORKDIR /opt/app-root/src

COPY --chown=1001:0 package*.json ./

USER 1001
RUN npm install

COPY --chown=1001:0 . .

RUN npm run build

FROM registry.access.redhat.com/ubi9/nginx-120

USER root

RUN rm -f /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/nginx.conf

# Install Python instead of Node
RUN yum install -y python3 && yum clean all

COPY --chmod=755 entrypoint.sh /entrypoint.sh

COPY --from=build --chown=1001:0 /opt/app-root/src/build /usr/share/nginx/html

# Make sure directory is writable
RUN chmod -R 775 /usr/share/nginx/html

USER 1001

EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]