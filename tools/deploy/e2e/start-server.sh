#!/usr/bin/env bash
# Turns the deploy job's runner into the server of deploy-app.yml's end-to-end test (DF-3, DF-15) and writes to
# $GITHUB_OUTPUT how the job reaches it: host, user, private-key, known-hosts and ca-file. The runner is an Ubuntu host
# with Docker, cron and flock, the shape `softure-deploy init` documents for a VPS, so the tag's own deploy.sh runs
# here unchanged:
#
# - the app folder /srv/<compose project>/ gets the tag's server script as deploy.sh (the first setup by hand);
# - a registry on IMAGE_REF's localhost:<port> holds the image the build job handed over as an archive, so deploy.sh's
#   pull is a real one; the compose file's other images come from mirror.gcr.io (Docker Hub limits anonymous pulls);
# - a certificate for APP_URL's host, signed by a CA made for this run and trusted by the runner, waits in Traefik's
#   ACME store (the compose file's `letsencrypt` volume), so Traefik serves it without asking Let's Encrypt, and
#   the host name points at 127.0.0.1;
# - sshd on 127.0.0.1:$SSH_PORT binds a key made for this run to server/forced-command.sh (record, then deploy.sh)
#   as the runner's user, which is in the docker group.
#
# Environment: SSH_PORT, E2E_DIR (this run's folder, keys included), GITHUB_OUTPUT, IMAGE_ARCHIVE (the build job's
# `docker` export), IMAGE_REF (<image>:<tag>, its registry localhost:<port>), SERVER_SCRIPT and COMPOSE_FILE (the tag's,
# relative to the working directory), APP_URL (https://<host>), DEPLOY_CLI (main.js of the CLI built from the tag).
set -euo pipefail

: "${SSH_PORT:?}" "${E2E_DIR:?}" "${GITHUB_OUTPUT:?}" "${IMAGE_ARCHIVE:?}" "${IMAGE_REF:?}"
: "${SERVER_SCRIPT:?}" "${COMPOSE_FILE:?}" "${APP_URL:?}" "${DEPLOY_CLI:?}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mirror="${IMAGE_MIRROR:-mirror.gcr.io}"
registry_container="softure-deploy-e2e-registry"
user="$(id -un)"

fail() {
  echo "::error::e2e server: $1"
  exit 1
}

# Names that go into sshd's config, the authorized line and /etc/hosts unquoted.
expect_plain() {
  if [[ ! "$2" =~ ^[A-Za-z0-9_./:@-]+$ ]]; then fail "$1 is not a plain path or name: $2"; fi
}

host="${APP_URL#https://}"
host="${host%%/*}"
host="${host%%:*}"
if [[ ! "$host" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]]; then fail "APP_URL has no host name: $APP_URL"; fi
registry="${IMAGE_REF%%/*}"
if [[ ! "$registry" =~ ^localhost:([0-9]{1,5})$ ]]; then fail "IMAGE_REF must name a localhost:<port> registry: $IMAGE_REF"; fi
registry_port="${BASH_REMATCH[1]}"
project="$(sed -n 's/^name:[[:space:]]*\([a-z0-9][a-z0-9_-]*\)[[:space:]]*$/\1/p' "$COMPOSE_FILE" | head -n 1)"
if [ -z "$project" ]; then fail "$COMPOSE_FILE has no top-level name:."; fi
if ! grep -q '^  letsencrypt:' "$COMPOSE_FILE"; then fail "$COMPOSE_FILE has no letsencrypt volume for Traefik's ACME store."; fi
app_dir="/srv/$project"
node_bin="$(dirname "$(command -v node)")"
for name in E2E_DIR:"$E2E_DIR" DEPLOY_CLI:"$DEPLOY_CLI" node:"$node_bin" user:"$user"; do expect_plain "${name%%:*}" "${name#*:}"; done

rm -rf "$E2E_DIR"
mkdir -p "$E2E_DIR/server" "$E2E_DIR/client" "$E2E_DIR/received" "$E2E_DIR/tls"

# ── tools a VPS has and a runner may lack ────────────────────────────────────────────────────────────────────────────
missing=()
if [ ! -x /usr/sbin/sshd ]; then missing+=(openssh-server); fi
if ! command -v crontab > /dev/null; then missing+=(cron); fi
if ! command -v flock > /dev/null; then missing+=(util-linux); fi
if (( ${#missing[@]} > 0 )); then
  echo "e2e server: installing ${missing[*]}"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends "${missing[@]}" > /dev/null
fi

# ── the image: the build job's archive, pushed to a registry on this runner ─────────────────────────────────────────
docker rm --force "$registry_container" > /dev/null 2>&1 || true
docker run --detach --name "$registry_container" --publish "127.0.0.1:$registry_port:5000" \
  "$mirror/library/registry:2" > /dev/null
docker load --quiet --input "$IMAGE_ARCHIVE" > /dev/null
if ! docker image inspect "$IMAGE_REF" > /dev/null 2>&1; then fail "the image archive holds no $IMAGE_REF."; fi
deadline=$((SECONDS + 30))
until curl -fsS --noproxy '*' -o /dev/null "http://127.0.0.1:$registry_port/v2/"; do
  if (( SECONDS >= deadline )); then fail "the registry did not answer on 127.0.0.1:$registry_port within 30s."; fi
  sleep 1
done
docker push --quiet "$IMAGE_REF" > /dev/null
docker image rm "$IMAGE_REF" > /dev/null
echo "e2e server: $IMAGE_REF is in the registry on this runner."

# Docker Hub images of the compose file (a name without a registry host) come from the mirror under their own name.
sed -n 's/^[[:space:]]*image:[[:space:]]*\([^[:space:]]*\)[[:space:]]*$/\1/p' "$COMPOSE_FILE" | sort -u | while IFS= read -r image; do
  first="${image%%/*}"
  if [[ "$image" == *'$'* ]] || { [[ "$image" == */* ]] && [[ "$first" == *[.:]* || "$first" == localhost ]]; }; then continue; fi
  source_image="$mirror/$image"
  if [[ "$image" != */* ]]; then source_image="$mirror/library/$image"; fi
  docker pull --quiet "$source_image" > /dev/null
  docker tag "$source_image" "$image"
  echo "e2e server: $image from $source_image"
done

# ── TLS: a CA of this run, trusted by the runner, and the host's certificate in Traefik's ACME store ────────────────
tls="$E2E_DIR/tls"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 2 \
  -subj "/CN=softure deploy e2e CA" -keyout "$tls/ca.key" -out "$tls/ca.crt" 2> /dev/null
openssl req -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -subj "/CN=$host" \
  -keyout "$tls/site.key" -out "$tls/site.csr" 2> /dev/null
printf 'subjectAltName=DNS:%s\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n' "$host" > "$tls/site.ext"
# 90 days: Traefik renews within 30 days of the end, and a renewal would ask Let's Encrypt.
openssl x509 -req -in "$tls/site.csr" -CA "$tls/ca.crt" -CAkey "$tls/ca.key" -CAcreateserial -days 90 \
  -extfile "$tls/site.ext" -out "$tls/site.crt" 2> /dev/null
# Traefik's store: the resolver's name, then base64 PEMs. With a certificate it does not need, it never registers.
printf '{"letsencrypt":{"Account":null,"Certificates":[{"domain":{"main":"%s"},"certificate":"%s","key":"%s","Store":"default"}]}}\n' \
  "$host" "$(base64 -w0 < "$tls/site.crt")" "$(base64 -w0 < "$tls/site.key")" > "$tls/acme.json"
volume="${project}_letsencrypt"
docker volume rm --force "$volume" > /dev/null 2>&1 || true
# Labelled as compose's own, so `compose up` adopts the volume without a warning.
docker volume create --label "com.docker.compose.project=$project" --label com.docker.compose.volume=letsencrypt \
  "$volume" > /dev/null
docker run --rm --volume "$volume:/letsencrypt" --volume "$tls:/tls:ro" "$mirror/library/registry:2" \
  install -m 0600 /tls/acme.json /letsencrypt/acme.json
sudo install -m 0644 "$tls/ca.crt" /usr/local/share/ca-certificates/softure-deploy-e2e.crt
sudo update-ca-certificates > /dev/null
if ! grep -q "[[:space:]]$host\$" /etc/hosts; then echo "127.0.0.1 $host" | sudo tee -a /etc/hosts > /dev/null; fi
echo "e2e server: $host resolves to 127.0.0.1 and has a certificate in $volume."

# ── the app folder: the first setup copies the server script there by hand ──────────────────────────────────────────
sudo install -d -m 0755 -o "$user" -g "$(id -gn)" "$app_dir"
install -m 0755 "$SERVER_SCRIPT" "$app_dir/deploy.sh"
{
  printf 'APP_DIR=%q\n' "$app_dir"
  printf 'NODE_BIN=%q\n' "$node_bin"
  printf 'DEPLOY_CLI=%q\n' "$DEPLOY_CLI"
  printf 'RECEIVED_DIR=%q\n' "$E2E_DIR/received"
} > "$E2E_DIR/server/forced-command.env"

# ── sshd: keys of this run, the deploy key bound to the forced command ──────────────────────────────────────────────
ssh-keygen -q -t ed25519 -N '' -C deploy-e2e-host -f "$E2E_DIR/server/ssh_host_ed25519_key"
ssh-keygen -q -t ed25519 -N '' -C deploy-e2e -f "$E2E_DIR/client/id_ed25519"
printf 'command="%s %s",restrict %s\n' "$here/server/forced-command.sh" "$E2E_DIR/server/forced-command.env" \
  "$(cat "$E2E_DIR/client/id_ed25519.pub")" > "$E2E_DIR/server/authorized_keys"
cat > "$E2E_DIR/server/sshd_config" <<SSHD
Port $SSH_PORT
ListenAddress 127.0.0.1
HostKey $E2E_DIR/server/ssh_host_ed25519_key
AuthorizedKeysFile $E2E_DIR/server/authorized_keys
# The keys live in the runner's temp folder, not in a home folder sshd would check the modes of.
StrictModes no
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
AllowUsers $user
UsePAM yes
PidFile $E2E_DIR/server/sshd.pid
SSHD
sudo mkdir -p /run/sshd
sudo /usr/sbin/sshd -t -f "$E2E_DIR/server/sshd_config"
sudo /usr/sbin/sshd -f "$E2E_DIR/server/sshd_config" -E "$E2E_DIR/server/sshd.log"

# Ready once sshd sends its banner (no ssh-keyscan: the host key is known, not learned).
deadline=$((SECONDS + 60))
until banner="$(timeout 2 bash -c "exec 3<>/dev/tcp/127.0.0.1/$SSH_PORT && head -c 4 <&3" 2> /dev/null)" \
  && [ "$banner" = "SSH-" ]; do
  if (( SECONDS >= deadline )); then
    sudo cat "$E2E_DIR/server/sshd.log" || true
    fail "sshd did not answer on 127.0.0.1:$SSH_PORT within 60s."
  fi
  sleep 1
done

{
  echo "host=127.0.0.1"
  echo "user=$user"
  echo "private-key<<PRIVATE_KEY_END"
  cat "$E2E_DIR/client/id_ed25519"
  echo "PRIVATE_KEY_END"
  echo "known-hosts=[127.0.0.1]:$SSH_PORT $(cut -d' ' -f1,2 "$E2E_DIR/server/ssh_host_ed25519_key.pub")"
  echo "ca-file=$tls/ca.crt"
} >> "$GITHUB_OUTPUT"
echo "e2e server: sshd answers on 127.0.0.1:$SSH_PORT as $user; the app folder is $app_dir."
