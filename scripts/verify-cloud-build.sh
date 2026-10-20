#!/bin/sh
set -eu
umask 077

# Linux-only acceptance: all database writes use this disposable container.
image=${1:-sultan-plan-verification:20261020}
port=${SULTAN_ACCEPTANCE_DB_PORT:-55437}
case "$port" in *[!0-9]*|'') exit 2 ;; esac
if ss -ltn | awk '{print $4}' | grep -Eq ":${port}$"; then
  printf '%s\n' 'The isolated acceptance port is already in use.' >&2
  exit 2
fi
suffix=$(date +%s)-$$
container=sultan-acceptance-db-$suffix
temporary=$(mktemp -d /tmp/sultan-acceptance-XXXXXX)
cleanup() {
  if [ "$(docker inspect --format '{{index .Config.Labels "sultan.acceptance"}}' "$container" 2>/dev/null || true)" = "$suffix" ]; then
    docker rm -fv "$container" >/dev/null
  fi
  case "$temporary" in /tmp/sultan-acceptance-*) rm -f "$temporary/test.env"; rmdir "$temporary" ;; esac
}
trap cleanup EXIT
trap 'exit 130' INT TERM
password=$(openssl rand -hex 24)
printf 'POSTGRES_USER=sultan_user\nPOSTGRES_DB=sultan_acceptance\nPOSTGRES_PASSWORD=%s\n' "$password" > "$temporary/test.env"
docker run -d --name "$container" --label "sultan.acceptance=$suffix" --env-file "$temporary/test.env" -p "127.0.0.1:$port:5432" postgres:15-alpine >/dev/null
attempt=0
until docker exec "$container" pg_isready -U sultan_user -d sultan_acceptance >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || exit 1
  sleep 1
done
printf 'DATABASE_URL=postgresql://sultan_user:%s@127.0.0.1:%s/sultan_acceptance\nDIRECT_URL=postgresql://sultan_user:%s@127.0.0.1:%s/sultan_acceptance\nACCEPTANCE_DB_CONTAINER=%s\nCI=true\nPLAYWRIGHT_HTML_OPEN=never\n' "$password" "$port" "$password" "$port" "$container" > "$temporary/test.env"
project=$(pwd -P)
# Mount current source directories only: the server .env is never mounted.
docker run --rm --network host --env-file "$temporary/test.env" \
  --mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
  --mount "type=bind,src=$project/app,dst=/app/app,readonly" \
  --mount "type=bind,src=$project/lib,dst=/app/lib,readonly" \
  --mount "type=bind,src=$project/scripts,dst=/app/scripts,readonly" \
  --mount "type=bind,src=$project/tests,dst=/app/tests,readonly" \
  --mount "type=bind,src=$project/config,dst=/app/config,readonly" \
  "$image" sh -c 'npm run build && npm test -- --runInBand && npm run lint && npx tsc --noEmit && npm run test:e2e:isolated && npm run test:restore-start -- --container "$ACCEPTANCE_DB_CONTAINER" && npm audit --omit=dev'
