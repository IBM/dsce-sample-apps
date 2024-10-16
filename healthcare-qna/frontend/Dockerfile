FROM node:16-slim AS BUILD

# Declaring env
ENV NODE_ENV development

# Setting up the work directory
WORKDIR /app

# Installing dependencies
COPY package*.json ./
RUN npm ci

# Copying all the files in our project
COPY . .

# Starting our application
CMD npm start
