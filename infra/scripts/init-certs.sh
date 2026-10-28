#!/usr/bin/env bash
# First-time HTTPS certificate for all four domains (one certificate named "lectures").
# Run once before `docker compose up -d`; afterwards the certbot service renews it automatically.
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$INFRA_DIR"
set -a
# shellcheck disable=SC1091
source .env
set +a

docker compose stop nginx 2>/dev/null || true
docker compose run --rm -p 80:80 --entrypoint certbot certbot certonly --standalone \
  --non-interactive --agree-tos -m "$LETSENCRYPT_EMAIL" \
  --cert-name lectures \
  -d "$API_DOMAIN" -d "$MEDIA_DOMAIN" -d "$WEB_DOMAIN" -d "$ADMIN_DOMAIN"
echo "Certificate ready. Start everything with: docker compose up -d --build"
