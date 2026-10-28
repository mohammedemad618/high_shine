#!/bin/sh
# MongoDB refuses to run a replica set with authentication unless every member shares a keyfile.
# Write it from MONGO_REPLICA_KEY with the permissions mongod demands, then hand over to the official entrypoint.
set -e
KEYFILE=/data/keyfile/mongo.key
if [ ! -s "$KEYFILE" ]; then
  : "${MONGO_REPLICA_KEY:?MONGO_REPLICA_KEY is required}"
  mkdir -p "$(dirname "$KEYFILE")"
  printf '%s' "$MONGO_REPLICA_KEY" | base64 | tr -d '\n' > "$KEYFILE"
fi
chown 999:999 "$KEYFILE"
chmod 400 "$KEYFILE"
exec docker-entrypoint.sh mongod "$@"
