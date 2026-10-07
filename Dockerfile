FROM ghcr.io/static-web-server/static-web-server:2-alpine

COPY --chown=1000:1000 . /home/sws/public

EXPOSE 80
