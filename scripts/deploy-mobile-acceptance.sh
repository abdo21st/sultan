#!/bin/bash
set -euo pipefail
umask 077

test "$(id -u)" = 0
root=/opt/sultan-mobile-acceptance
source_root=$(pwd -P)
release_sha=${1:-}
if [[ ! "$release_sha" =~ ^[a-f0-9]{40}$ ]]; then
  echo 'Provide the full 40-character QA release commit.' >&2
  exit 2
fi
release_tag=${release_sha:0:12}
test "$(cat "$root/.managed-by-sultan")" = 'sultan-mobile-acceptance-v1'
test -f "$source_root/Dockerfile" && test -f "$source_root/config/mobile-acceptance.compose.yml"
test -f "$root/.env" && test ! -L "$root/.env"
test "$(stat -c '%a' "$root/.env")" = 600

node "$source_root/scripts/update-mobile-acceptance-env.mjs"
previous_image=$(docker compose -f "$root/compose.yml" config --images | grep '^sultan-release:' | head -n 1)
previous_tag=${previous_image#sultan-release:}
if [[ ! "$previous_tag" =~ ^[a-f0-9]{7,40}$ ]]; then
  echo 'The live QA compose file does not point to a recognized Sultan release image.' >&2
  exit 1
fi
previous_compose="$root/.compose-rollback-$release_tag.yml"
test ! -e "$previous_compose"
install -o root -g root -m 600 "$root/compose.yml" "$previous_compose"

rollback_candidate() {
  local code=${1:-1}
  trap - ERR
  node "$source_root/scripts/update-mobile-acceptance-env.mjs" --release-tag "$previous_tag" >/dev/null || true
  install -o root -g root -m 600 "$previous_compose" "$root/compose.yml"
  (cd "$root" && docker compose -f compose.yml up -d --no-deps --force-recreate --wait --wait-timeout 180 sultan-app) >/dev/null || true
  curl -fsS --max-time 10 http://127.0.0.1:3375/api/health >/dev/null || true
  echo 'QA candidate failed; the previous app release was restored.' >&2
  exit "$code"
}

docker compose -f "$root/compose.yml" ps --format '{{.Service}} {{.State}} {{.Health}}' | grep -q '^sultan-db running healthy$'
docker compose -f "$root/compose.yml" ps --format '{{.Service}} {{.State}} {{.Health}}' | grep -q '^sultan-app running healthy$'
docker build --target runner --build-arg "APP_REVISION=$release_sha" -t "sultan-release:$release_tag" "$source_root"
docker build --target migrator --build-arg "APP_REVISION=$release_sha" -t "sultan-release-migrator:$release_tag" "$source_root"
test "$(docker inspect "sultan-release:$release_tag" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')" = "$release_sha"
test "$(docker inspect "sultan-release-migrator:$release_tag" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')" = "$release_sha"

bash "$source_root/scripts/provision-mobile-acceptance-db-roles.sh"
node "$source_root/scripts/update-mobile-acceptance-env.mjs" --release-tag "$release_tag"
install -o root -g root -m 600 "$source_root/config/mobile-acceptance.compose.yml" "$root/compose.yml"
if ! docker compose -f "$root/compose.yml" config --quiet; then rollback_candidate 1; fi
if ! docker compose -f "$root/compose.yml" run --rm --no-deps sultan-migrate; then rollback_candidate 1; fi
bash "$source_root/scripts/provision-mobile-acceptance-db-roles.sh"
if ! docker compose -f "$root/compose.yml" up -d --no-deps --force-recreate --wait --wait-timeout 180 sultan-app; then rollback_candidate 1; fi
if ! curl -fsS --max-time 10 http://127.0.0.1:3375/api/health >/dev/null; then rollback_candidate 1; fi
if ! node "$source_root/scripts/verify-mobile-acceptance-security-local.mjs"; then rollback_candidate 1; fi

echo "QA release $release_tag is healthy; production was not changed."
