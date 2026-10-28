# Build context: repository root (see infra/docker-compose.yml)

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
# Ride out registry hiccups instead of failing the whole image build.
ENV npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 npm_config_fetch_retry_maxtimeout=120000

# Root manifest + lockfile and every workspace manifest, so `npm ci` sees a lockfile that matches the workspace layout.
COPY package.json package-lock.json ./
COPY packages/shared packages/shared
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
# Installs only what apps/admin needs (dev deps included: vite is needed to build).
RUN --mount=type=cache,target=/root/.npm npm ci --workspace apps/admin --include-workspace-root=false --no-audit --no-fund

COPY apps/admin apps/admin

# Vite inlines VITE_* variables at build time.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build -w apps/admin

# ---- serve ----
FROM nginx:alpine
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
