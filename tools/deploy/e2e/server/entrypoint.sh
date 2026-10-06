#!/bin/sh
# Installs the host key and the authorized line start-server.sh mounted at /e2e/server with the owners and modes sshd
# insists on, then runs sshd in the foreground with its log on stderr (`docker logs`). Keys only, user deploy only.
set -eu
install -m 0600 /e2e/server/ssh_host_ed25519_key /etc/ssh/ssh_host_ed25519_key
install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
install -m 0600 -o deploy -g deploy /e2e/server/authorized_keys /home/deploy/.ssh/authorized_keys
exec /usr/sbin/sshd -D -e \
  -h /etc/ssh/ssh_host_ed25519_key \
  -o PasswordAuthentication=no \
  -o KbdInteractiveAuthentication=no \
  -o PermitRootLogin=no \
  -o AllowUsers=deploy
