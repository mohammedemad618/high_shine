# Build context: repository root (see infra/docker-compose.yml)
FROM node:22-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
ENV NODE_ENV=production
ENV npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 npm_config_fetch_retry_maxtimeout=120000

COPY package.json package-lock.json* ./
COPY packages/shared packages/shared
COPY apps/worker/package.json apps/worker/package.json
RUN npm install --omit=dev --workspace apps/worker --include-workspace-root=false --no-audit --no-fund

COPY apps/worker apps/worker

USER node
WORKDIR /app/apps/worker
# Long transcodes: give the running job time to finish on `docker compose stop`.
STOPSIGNAL SIGTERM
CMD ["node", "src/worker.js"]
