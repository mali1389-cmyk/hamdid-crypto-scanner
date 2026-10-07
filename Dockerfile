FROM ghcr.io/static-web-server/static-web-server:2-alpine

COPY . /public

EXPOSE 80
