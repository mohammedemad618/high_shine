# syntax=docker/dockerfile:1
# Build context: repository root (see infra/docker-compose.yml). Ignore rules: apps/web/Dockerfile.dockerignore

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
# Ride out registry hiccups instead of failing the whole image build.
ENV npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 npm_config_fetch_retry_maxtimeout=120000
ENV NEXT_TELEMETRY_DISABLED=1

# Every workspace manifest is copied so the root lockfile validates; only apps/web's dependencies are installed.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --workspace apps/web --include-workspace-root=false --no-audit --no-fund

COPY packages/shared packages/shared
COPY apps/web apps/web

# NEXT_PUBLIC_* values are inlined into the browser bundle at build time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

RUN npm run build -w apps/web

# ---------- run ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# outputFileTracingRoot is the repo root, so the standalone tree mirrors the monorepo (server at apps/web/server.js).
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
# INTERNAL_API_URL (runtime) lets server components reach the api container directly.
CMD ["node", "apps/web/server.js"]
