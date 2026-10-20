#!/bin/sh
set -eu
case "${SSH_ORIGINAL_COMMAND-}" in
  status|health|restart|backup)
    exec /usr/bin/env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin LANG=C LC_ALL=C /usr/bin/sudo -n /usr/local/sbin/sultan-operate "$SSH_ORIGINAL_COMMAND"
    ;;
  *)
    printf '%s\n' 'Use one Sultan operation: status, health, restart, or backup.' >&2
    exit 1
    ;;
esac
