#!/bin/bash

# docker build --build-arg CLIENT_BUILD_ENV=docker -t eesi_demos_ui:latest .
# docker run -it -p 80:80 smartthings-client:latest

BUILD_ENV="$1"
isProd="false"

case $1 in
  "dev") BUILD_ENV=""; isProd="false";;
  "ce") BUILD_ENV="ce"; isProd="false";;
  "docker") BUILD_ENV="docker"; isProd="false";;
  "production") BUILD_ENV="production"; isProd="true";;
  "") BUILD_ENV=""; isProd="false";;
esac

echo "*********** RUNNING CLIENT BUILD WITH BUILD_ENV=$BUILD_ENV environment ************ "

function build_client {
  npm install -f
  npm install -g @angular/cli@^14.0.5
  npm install --only=dev
  npm audit fix
  ng build --configuration $BUILD_ENV
  rm -rf node_modules
}

build_client
