FROM ghcr.io/static-web-server/static-web-server:2-alpine

USER root

WORKDIR /app

COPY . /app/public
COPY caddy /app/caddy
COPY Caddyfile /app/Caddyfile

EXPOSE 80

ENTRYPOINT ["/app/caddy"]

CMD ["run", "--config", "/app/Caddyfile", "--adapter", "caddyfile"]
