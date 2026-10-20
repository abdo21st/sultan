#!/bin/bash
set -euo pipefail
umask 077
test "$(id -u)" = 0
project=$(pwd -P)
public_key=${1:?Pass the public Ed25519 key file}
test -f "$public_key"
test "$(wc -l < "$public_key")" = 1
normalized_key=$(tr -d '\r' < "$public_key")
grep -Eq '^ssh-ed25519 [A-Za-z0-9+/=]+( [A-Za-z0-9_.@ -]+)?$' <<< "$normalized_key"
ssh-keygen -lf "$public_key" >/dev/null
operator_home=/var/lib/sultan-operator
marker=$operator_home/.managed-by-sultan
if id sultan-operator >/dev/null 2>&1; then
  test -f "$marker"
  test "$(cat "$marker")" = sultan-restricted-operator-v1
else
  test ! -e "$operator_home"
  for destination in /usr/local/sbin/sultan-operate /usr/local/libexec/sultan-ssh-entrypoint /etc/sudoers.d/sultan-operator /etc/ssh/sshd_config.d/70-sultan-operator.conf; do
    test ! -e "$destination"
  done
  useradd --create-home --user-group --home-dir "$operator_home" --shell /bin/sh sultan-operator
  printf '%s\n' sultan-restricted-operator-v1 > "$marker"
fi
test "$(id -Gn sultan-operator)" = sultan-operator
chown root:root "$operator_home" "$marker"
chmod 755 "$operator_home"
chmod 600 "$marker"
install -d -o root -g root -m 755 "$operator_home/.ssh" /usr/local/libexec
install -o root -g root -m 755 "$project/scripts/sultan-operate.py" /usr/local/sbin/sultan-operate
install -o root -g root -m 755 "$project/config/ssh/sultan-ssh-entrypoint.sh" /usr/local/libexec/sultan-ssh-entrypoint
/usr/sbin/visudo -cf "$project/config/ssh/sultan-operator.sudoers" >/dev/null
install -o root -g root -m 440 "$project/config/ssh/sultan-operator.sudoers" /etc/sudoers.d/sultan-operator
printf '%s' 'restrict,command="/usr/local/libexec/sultan-ssh-entrypoint" ' > "$operator_home/.ssh/authorized_keys"
printf '%s\n' "$normalized_key" >> "$operator_home/.ssh/authorized_keys"
chown root:root "$operator_home/.ssh/authorized_keys"
chmod 644 "$operator_home/.ssh/authorized_keys"
test ! -L /etc/ssh/sshd_config.d/70-sultan-operator.conf
install -o root -g root -m 644 "$project/config/ssh/70-sultan-operator.conf" /etc/ssh/sshd_config.d/70-sultan-operator.conf
/usr/sbin/sshd -t
effective=$(/usr/sbin/sshd -T -C user=sultan-operator,host=localhost,addr=127.0.0.1)
for expected in 'forcecommand /usr/local/libexec/sultan-ssh-entrypoint' 'authenticationmethods publickey' 'passwordauthentication no' 'kbdinteractiveauthentication no' 'disableforwarding yes' 'permittty no' 'permituserrc no'; do
  grep -Fxq "$expected" <<< "$effective"
done
/usr/sbin/visudo -c >/dev/null
systemctl reload ssh
printf '%s\n' 'Sultan restricted operator installed. Verify public-key access from a separate connection.'
