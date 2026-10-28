# Build context: repository root (see infra/docker-compose.yml)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 npm_config_fetch_retry_maxtimeout=120000

COPY package.json package-lock.json* ./
COPY packages/shared packages/shared
COPY apps/api/package.json apps/api/package.json
RUN npm install --omit=dev --workspace apps/api --include-workspace-root=false --no-audit --no-fund

COPY apps/api apps/api

USER node
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "src/server.js"]
