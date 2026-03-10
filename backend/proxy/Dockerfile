# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --cache /root/.npm

COPY . .

EXPOSE 4006

CMD ["node", "index.js"]
