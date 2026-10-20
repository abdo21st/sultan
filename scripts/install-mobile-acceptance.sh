#!/bin/bash
set -euo pipefail
umask 077
test "$(id -u)" = 0
source_root=$(pwd -P)
root=/opt/sultan-mobile-acceptance
available=/etc/nginx/sites-available/sultan-mobile-acceptance.conf
enabled=/etc/nginx/sites-enabled/sultan-mobile-acceptance.conf
test ! -e "$root"
test ! -e "$available"
test ! -L "$enabled"
test ! -e /var/www/sultan-mobile-acceptance
test "$(docker image inspect sultan-release:e6f3a63 --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')" = e6f3a63d2b59a471722ea0cfee79f327b22ed11f
if ss -ltn | awk '{print $4}' | grep -Eq ':3375$'; then
  printf '%s\n' 'The QA port is already in use.' >&2
  exit 1
fi
openssl x509 -in /etc/letsencrypt/live/mtapp.ly/fullchain.pem -noout -checkend 86400 >/dev/null
openssl x509 -in /etc/letsencrypt/live/mtapp.ly/fullchain.pem -noout -ext subjectAltName | grep -Fq 'DNS:*.mtapp.ly'
node scripts/provision-mobile-acceptance.mjs
install -o root -g root -m 600 config/mobile-acceptance.compose.yml "$root/compose.yml"
install -o root -g root -m 600 scripts/mobile-acceptance-fixture.mjs "$root/fixture.mjs"
cd "$root"
docker compose -f compose.yml config --quiet
docker compose -f compose.yml up -d --wait --wait-timeout 180 sultan-app
docker compose -f compose.yml run --rm --no-deps -T sultan-migrate node --input-type=module - < fixture.mjs > fixture-result.json
docker run --rm --read-only --network none --mount type=volume,src=sultan-mobile-acceptance-images,dst=/app/storage/order-images sultan-release:e6f3a63 node -e "require('fs').writeFileSync('/app/storage/order-images/f0000000-0000-4000-8000-000000000001.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=','base64'),{mode:0o600})"
curl -fsS --max-time 10 http://127.0.0.1:3375/api/health >/dev/null
install -d -o root -g root -m 755 /var/www/sultan-mobile-acceptance
install -o root -g root -m 644 "$source_root/config/mobile-acceptance.manifest.json" /var/www/sultan-mobile-acceptance/manifest.json
for log in /var/log/nginx/sultan-mobile-acceptance.access.log /var/log/nginx/sultan-mobile-acceptance.error.log; do
  test ! -e "$log"
  install -o root -g adm -m 640 /dev/null "$log"
done
install -o root -g root -m 644 "$source_root/config/nginx/sultan-mobile-acceptance.conf" "$available"
ln -s "$available" "$enabled"
if ! nginx -t; then
  if [ "$(readlink "$enabled")" = "$available" ]; then rm -f -- "$enabled"; fi
  exit 1
fi
if ! systemctl reload nginx; then
  if [ "$(readlink "$enabled")" = "$available" ]; then rm -f -- "$enabled"; fi
  nginx -t && systemctl reload nginx
  exit 1
fi
printf '%s\n' 'Mobile acceptance environment is running; verify HTTPS and synthetic account access.'
