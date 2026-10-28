#!/usr/bin/env bash
# Nightly backup: MongoDB dump + original uploads and attachments, copied to a second server with rclone.
# HLS output is not backed up: it can be regenerated from the originals (reprocess).
# Note: the dump contains media_keys (decryption keys). Keep the backup remote private/encrypted.
#
# cron (as root on the VPS):
#   0 3 * * * /opt/lectures/infra/scripts/backup.sh >> /var/log/lectures-backup.log 2>&1
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$INFRA_DIR"
set -a
# shellcheck disable=SC1091
source .env
set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/lectures}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%F-%H%M)"
mkdir -p "$BACKUP_DIR"

echo "[$(date -Is)] Dumping MongoDB"
docker compose exec -T mongo mongodump \
  --username "$MONGO_ROOT_USER" --password "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin \
  --db "$MONGO_DB" --archive --gzip > "$BACKUP_DIR/mongo-$STAMP.archive.gz"

find "$BACKUP_DIR" -name 'mongo-*.archive.gz' -mtime +"$KEEP_DAYS" -delete

echo "[$(date -Is)] Copying to $RCLONE_REMOTE"
rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE/db" --include 'mongo-*.archive.gz'
for dir in uploads attachments covers; do
  if [ -d "$MEDIA_HOST_DIR/$dir" ]; then
    # tus keeps <id>.json next to every upload; copy both so a restore can be reprocessed.
    rclone copy "$MEDIA_HOST_DIR/$dir" "$RCLONE_REMOTE/media/$dir"
  fi
done
rclone delete "$RCLONE_REMOTE/db" --min-age "${KEEP_DAYS}d" --include 'mongo-*.archive.gz'

echo "[$(date -Is)] Backup done"
