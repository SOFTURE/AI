#!/usr/bin/env bash
# Starts the throwaway SSH server of deploy-app.yml's end-to-end test (DF-3) next to the deploy job, on
# 127.0.0.1:$SSH_PORT, and writes to $GITHUB_OUTPUT how the job's send step reaches it: host, user, private-key and
# known-hosts. Both key pairs are made here for this run; the container gets only the host key and the authorized line
# (command="record.sh",restrict), never the client's private key. What record.sh writes lands in $E2E_DIR/received.
set -euo pipefail

: "${SSH_PORT:?}" "${E2E_DIR:?}" "${GITHUB_OUTPUT:?}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
image="softure-deploy-e2e-server:local"
container="softure-deploy-e2e-server"
alpine_image="${ALPINE_IMAGE:-mirror.gcr.io/library/alpine:3.22}"

rm -rf "$E2E_DIR"
mkdir -p "$E2E_DIR/server" "$E2E_DIR/client" "$E2E_DIR/received"
# record.sh runs as the container's user deploy, not as the runner's user that owns this folder.
chmod 0777 "$E2E_DIR/received"
ssh-keygen -q -t ed25519 -N '' -C deploy-e2e-host -f "$E2E_DIR/server/ssh_host_ed25519_key"
ssh-keygen -q -t ed25519 -N '' -C deploy-e2e -f "$E2E_DIR/client/id_ed25519"
printf 'command="/usr/local/bin/record.sh",restrict %s\n' "$(cat "$E2E_DIR/client/id_ed25519.pub")" \
  > "$E2E_DIR/server/authorized_keys"

docker build --quiet --build-arg "ALPINE_IMAGE=$alpine_image" --tag "$image" "$here/server" > /dev/null
docker rm --force "$container" > /dev/null 2>&1 || true
docker run --detach --name "$container" \
  --publish "127.0.0.1:$SSH_PORT:22" \
  --volume "$E2E_DIR/server:/e2e/server:ro" \
  --volume "$E2E_DIR/received:/e2e/received" \
  "$image" > /dev/null

# Ready once sshd sends its banner (no ssh-keyscan: the host key is known, not learned).
deadline=$((SECONDS + 60))
until banner="$(timeout 2 bash -c "exec 3<>/dev/tcp/127.0.0.1/$SSH_PORT && head -c 4 <&3" 2> /dev/null)" \
  && [ "$banner" = "SSH-" ]; do
  if (( SECONDS >= deadline )); then
    echo "::error::The e2e SSH server did not answer on 127.0.0.1:$SSH_PORT within 60s."
    docker logs "$container" || true
    exit 1
  fi
  sleep 1
done

{
  echo "host=127.0.0.1"
  echo "user=deploy"
  echo "private-key<<PRIVATE_KEY_END"
  cat "$E2E_DIR/client/id_ed25519"
  echo "PRIVATE_KEY_END"
  echo "known-hosts=[127.0.0.1]:$SSH_PORT $(cut -d' ' -f1,2 "$E2E_DIR/server/ssh_host_ed25519_key.pub")"
} >> "$GITHUB_OUTPUT"
echo "e2e server: sshd answers on 127.0.0.1:$SSH_PORT as user deploy."
