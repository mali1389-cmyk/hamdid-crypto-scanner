FROM ghcr.io/static-web-server/static-web-server:2-alpine

USER root

RUN apk add --no-cache nodejs

WORKDIR /app

COPY . /app/public
COPY server.mjs /app/server.mjs

EXPOSE 80

ENV PORT=80

CMD ["node", "/app/server.mjs"]
