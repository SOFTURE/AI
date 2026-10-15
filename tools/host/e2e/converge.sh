#!/usr/bin/env bash
# Converges ansible/app.yml, what `softure-host app add` runs on the server, against a throwaway Ubuntu container
# with sshd, and checks the result end to end: the folder and the first deploy.sh, one release key line per app
# (replaced on rotation, never duplicated), a second run that changes nothing, and a real SSH login with the key the
# CLI issues landing in deploy.sh through the forced command. Both playbooks are syntax-checked first.
#
# Needs docker, ansible-core, ssh and node with the workspace installed (npm ci). The collections come from
# ansible/requirements.yml unless HOST_E2E_COLLECTIONS points at a folder that already holds them.
# HOST_E2E_IMAGE (default ubuntu:24.04) and HOST_E2E_SSH_PORT (default 2222) change the container.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
package="$(dirname "$here")"
repo="$(cd "$package/../.." && pwd)"
image="${HOST_E2E_IMAGE:-ubuntu:24.04}"
port="${HOST_E2E_SSH_PORT:-2222}"
container="softure-host-e2e-$$"
work="$(mktemp -d)"

cleanup() {
  docker rm -f "$container" > /dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

fail() {
  echo "converge: FAIL: $1" >&2
  exit 1
}

step() {
  echo "converge: $1"
}

collections="${HOST_E2E_COLLECTIONS:-$work/collections}"
if [ -z "${HOST_E2E_COLLECTIONS:-}" ]; then
  step "installing the pinned collections"
  ansible-galaxy collection install -r "$package/ansible/requirements.yml" -p "$collections"
fi
export ANSIBLE_COLLECTIONS_PATH="$collections"
export ANSIBLE_HOST_KEY_CHECKING=False

step "syntax check"
ansible-playbook --syntax-check -i server, "$package/ansible/server.yml"
ansible-playbook --syntax-check -i server, "$package/ansible/app.yml"

step "starting $image"
docker run -d --name "$container" -p "127.0.0.1:$port:22" "$image" sleep infinity > /dev/null
docker exec "$container" bash -c 'apt-get update -qq > /dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3 openssh-server > /dev/null && groupadd -f docker && install -d -m 0755 -o root -g root /run/sshd && ssh-keygen -A && /usr/sbin/sshd'

printf '#!/usr/bin/env bash\necho "deploy.sh ran: ${SSH_ORIGINAL_COMMAND:-none}"\n' > "$work/deploy.sh"
connection="{\"ansible_connection\":\"community.docker.docker\",\"ansible_host\":\"$container\",\"ansible_user\":\"root\"}"

# Runs app.yml with the CLI's own vars; $1 is the key file to issue (empty: no key). Prints the recap line.
converge() {
  local vars
  if [ -n "$1" ]; then
    vars="$(cd "$repo" && npx tsx "$package/scripts/e2e-app-vars.ts" "$work/deploy.sh" "$1")"
  else
    vars="$(cd "$repo" && npx tsx "$package/scripts/e2e-app-vars.ts" "$work/deploy.sh")"
  fi
  ansible-playbook "$package/ansible/app.yml" -i server, -e "$vars" -e "$connection" > "$work/run.log" 2>&1 || {
    cat "$work/run.log" >&2
    return 1
  }
  grep -E '^server +:' "$work/run.log"
}

in_container() {
  docker exec "$container" bash -c "$1"
}

login() {
  ssh -i "$1" -p "$port" -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
    deploy@127.0.0.1 status
}

step "first run issues key A: $(converge "$work/key-a")"
recap="$(converge "$work/key-a")"
step "second run with key A: $recap"
case "$recap" in
  *" changed=0 "*) ;;
  *) fail "a second run with the same key changed something" ;;
esac

step "the folder, deploy.sh and one key line"
[ "$(in_container 'stat -c "%U:%G %a" /srv/notes')" = "deploy:deploy 750" ] || fail "/srv/notes owner or mode"
[ "$(in_container 'stat -c "%U %a" /srv/notes/deploy.sh')" = "deploy 755" ] || fail "deploy.sh owner or mode"
in_container 'cat /srv/notes/deploy.sh' | cmp -s - "$work/deploy.sh" || fail "deploy.sh content"
[ "$(in_container 'grep -c " notes-release$" /home/deploy/.ssh/authorized_keys')" = "1" ] || fail "not exactly one key line"
in_container 'grep " notes-release$" /home/deploy/.ssh/authorized_keys' | grep -q '^command="/srv/notes/deploy.sh",restrict ssh-ed25519 ' \
  || fail "the key line has no forced command"
in_container 'id -nG deploy' | grep -qw docker || fail "deploy is not in docker"
in_container 'id -nG deploy' | grep -qw sudo && fail "deploy is in sudo"

step "a real login with the issued key runs deploy.sh"
[ "$(login "$work/key-a")" = "deploy.sh ran: status" ] || fail "login with the issued key"

step "a deploy.sh the releases replaced is never overwritten"
in_container 'echo "# replaced by a release" >> /srv/notes/deploy.sh'
converge "" > /dev/null
in_container 'grep -q "replaced by a release" /srv/notes/deploy.sh' || fail "deploy.sh was overwritten"

step "rotation replaces the line: the old key is refused, the new one logs in"
converge "$work/key-b" > /dev/null
[ "$(in_container 'grep -c " notes-release$" /home/deploy/.ssh/authorized_keys')" = "1" ] || fail "rotation duplicated the line"
login "$work/key-a" > /dev/null 2>&1 && fail "the old key still logs in"
[ "$(login "$work/key-b")" = "deploy.sh ran: status" ] || fail "login with the rotated key"

step "a run without a key refuses an app that has no line"
in_container 'sed -i "/ notes-release$/d" /home/deploy/.ssh/authorized_keys'
if converge "" > /dev/null 2> "$work/refusal.log"; then fail "a run without a key accepted an app without a line"; fi
grep -q -- "--rotate-key" "$work/refusal.log" || fail "the refusal does not point at --rotate-key"

step "PASS"
