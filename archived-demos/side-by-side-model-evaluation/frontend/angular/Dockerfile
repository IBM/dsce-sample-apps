##
## Copyright 2020 IBM Corporation
##
## This will build front end container running nginx
## Author: Gurvinder Singh (gurvsin3@in.ibm.com)
##
## docker build --build-arg CLIENT_BUILD_ENV=production -t sinny777/eesi_demos_ui:latest .
## docker run -it -d -p 4200:80 --network my-network --name eesi_demos_ui eesi_demos_ui:latest
## docker run -it -d -p 80:80 --name eesi_demos_ui sinny777/eesi_demos_ui:latest
##

FROM node:16-alpine as client-build

LABEL version="1.0" \
      description="EESI Lab Demos Web/UI " \
      author="Gurvinder Singh <sinny777@gmail.com>" \
      profile="http://www.gurvinder.info"

RUN mkdir -p /app
WORKDIR /app

ARG CLIENT_BUILD_ENV=production
ENV PORT 80

# --no-cache: download package index on-the-fly, no need to cleanup afterwards
# --virtual: bundle packages, remove whole bundle at once, when done
RUN apk --no-cache --virtual build-dependencies add \
    # python \
    make \
    g++ \
    git \
    --update bash && rm -rf /var/cache/apk/*

COPY . /app
COPY ./build.sh /app/

RUN chgrp -R 0 /app && \
    chmod -R g=u /app && \
    chmod 755 /app/build.sh && \
    /app/build.sh $CLIENT_BUILD_ENV && \
    apk del build-dependencies

FROM nginx:1.13.5
# FROM nginxinc/nginx-unprivileged
COPY --from=client-build app/dist /usr/share/nginx/html
COPY --from=client-build app/src/config/nginx.conf /etc/nginx/nginx.conf
# COPY --from=client-build ./.nginx/nginx.conf /etc/nginx/nginx.conf

RUN chgrp -R 0 /var/cache/nginx /var/run /var/log/nginx && \
    chmod -R g=u /var/cache/nginx /var/run /var/log/nginx

# USER 1001

EXPOSE $PORT

CMD ["nginx", "-g", "daemon off;"]

