#!/bin/sh
# Container entrypoint: apply pending DB migrations, then start the given role.
#
#   scripts/start.sh web      -> prisma migrate deploy + Next.js app  (default)
#   scripts/start.sh worker   -> prisma migrate deploy + queue worker
#
# `prisma migrate deploy` is idempotent and takes a Postgres advisory lock, so it
# is safe even if the web and worker containers run it concurrently on startup.
set -e

echo "[start] applying database migrations (prisma migrate deploy)…"
npx prisma migrate deploy

role="${1:-web}"
case "$role" in
  web)
    echo "[start] starting web app…"
    exec npm run start
    ;;
  worker)
    echo "[start] starting queue worker…"
    exec npm run worker
    ;;
  *)
    echo "[start] unknown role '$role' (expected 'web' or 'worker')" >&2
    exit 1
    ;;
esac
