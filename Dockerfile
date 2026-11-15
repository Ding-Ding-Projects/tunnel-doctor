# syntax=docker/dockerfile:1
FROM node:22-alpine

ARG BUILD_TIME=""
ARG VCS_REF=""
LABEL org.opencontainers.image.title="Tunnel Doctor" \
      org.opencontainers.image.description="Diagnoses and fixes Cloudflare Tunnel, DNS and Home Assistant reverse-proxy problems" \
      org.opencontainers.image.source="https://github.com/Ding-Ding-Projects/tunnel-doctor" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_TIME}"

ENV NODE_ENV=production \
    TD_DATA_DIR=/data \
    TD_HOST=0.0.0.0 \
    TD_PORT=8080 \
    TD_BUILD_TIME=${BUILD_TIME}

WORKDIR /app
COPY package.json ./
COPY core/ core/
COPY server/ server/
COPY web/ web/

RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/api/health || exit 1

CMD ["node", "server/index.js"]
