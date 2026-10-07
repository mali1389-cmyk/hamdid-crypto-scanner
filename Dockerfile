FROM ghcr.io/oven-sh/bun:1-alpine

WORKDIR /app

COPY . /app/public
COPY server.ts /app/server.ts

EXPOSE 80

ENV PORT=80

CMD ["bun", "run", "/app/server.ts"]
