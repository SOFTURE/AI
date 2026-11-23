#!/usr/bin/env bash
# Converges ansible/app.yml, what `softure-host app add` runs on the server, against a throwaway Ubuntu container
# with sshd, and checks the result end to end: a check-mode run on a first onboarding that passes and changes nothing,
# the folder and the first deploy.sh, one release key line per app (replaced on rotation, never duplicated), a second
# run that changes nothing, a real SSH login with the key the CLI issues landing in deploy.sh through the forced
# command, and a deploy user with sudo rights refused before any change. Then ansible/operator.yml, what
# `softure-host operator add-key` and `remove-key` run: one line per label, other lines byte-equal, the operator key
# reaching only deploy.sh, check mode changing nothing, a key another line holds refused. Every playbook is
# syntax-checked first.
# The container's sshd starts with `AllowUsers root`, like a server `softure-host server` never provisioned: the deploy
# user gets in through the drop-in app.yml adds, an AllowGroups that would still refuse it stops the run before any
# change, and `softure-host survey` (the real CLI over SSH as root) changes nothing (issue #1432).
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
  ssh-keygen -R "[127.0.0.1]:$port" > /dev/null 2>&1 || true
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
ansible-playbook --syntax-check -i server, "$package/ansible/operator.yml"

step "starting $image"
docker run -d --name "$container" -p "127.0.0.1:$port:22" "$image" sleep infinity > /dev/null
ssh-keygen -q -t ed25519 -N "" -C admin -f "$work/admin-key"
docker exec "$container" bash -c 'apt-get update -qq > /dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3 openssh-server > /dev/null && groupadd -f docker && install -d -m 0755 -o root -g root /run/sshd && ssh-keygen -A && echo "AllowUsers root" >> /etc/ssh/sshd_config && /usr/sbin/sshd'
docker exec -i "$container" bash -c 'install -d -m 0700 /root/.ssh && cat > /root/.ssh/authorized_keys && chmod 0600 /root/.ssh/authorized_keys' < "$work/admin-key.pub"

printf '#!/usr/bin/env bash\necho "deploy.sh ran: ${SSH_ORIGINAL_COMMAND:-none}"\n' > "$work/deploy.sh"
connection="{\"ansible_connection\":\"community.docker.docker\",\"ansible_host\":\"$container\",\"ansible_user\":\"root\"}"

# Runs app.yml with the CLI's own vars; $1 is the key file to issue (empty: no key), $2 an optional --check.
# Prints the recap line.
converge() {
  local vars mode="${2:-}"
  if [ -n "$1" ]; then
    vars="$(cd "$repo" && npx tsx "$package/scripts/e2e-app-vars.ts" "$work/deploy.sh" "$1")"
  else
    vars="$(cd "$repo" && npx tsx "$package/scripts/e2e-app-vars.ts" "$work/deploy.sh")"
  fi
  ansible-playbook "$package/ansible/app.yml" -i server, -e "$vars" -e "$connection" ${mode:+"$mode"} > "$work/run.log" 2>&1 || {
    cat "$work/run.log" >&2
    return 1
  }
  grep -E '^server +:' "$work/run.log"
}

in_container() {
  docker exec "$container" bash -c "$1"
}

# Logs in as the deploy user with key $1 and asks for $2 (default: status; "-": no command, as for a shell).
login() {
  local command="${2:-status}"
  set -- ssh -i "$1" -p "$port" -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -o LogLevel=ERROR deploy@127.0.0.1
  if [ "$command" = "-" ]; then "$@"; else "$@" "$command"; fi
}

# Runs operator.yml with the CLI's own vars: $1 present or absent, $2 the label, $3 the key file, $4 --check (with
# --diff, as the CLI runs it) or empty.
# Prints the recap line.
operator() {
  local vars
  vars="$(cd "$repo" && npx tsx "$package/scripts/e2e-operator-vars.ts" "$1" "$2" ${3:+"$3"})"
  ansible-playbook "$package/ansible/operator.yml" -i server, -e "$vars" -e "$connection" ${4:+"$4" --diff} > "$work/operator.log" 2>&1 || {
    cat "$work/operator.log" >&2
    return 1
  }
  grep -E '^server +:' "$work/operator.log"
}

# The authorized_keys lines that are not notes' operator lines, which operator.yml must never change.
other_lines() {
  in_container 'grep -v " notes-operator-[a-z0-9]*$" /home/deploy/.ssh/authorized_keys'
}

recap="$(converge "$work/key-a" --check)"
step "check mode on a first onboarding: $recap"
grep -q "planned change: the deploy user deploy does not exist yet" "$work/run.log" \
  || fail "check mode does not report the deploy user as a planned change"
in_container 'id deploy' > /dev/null 2>&1 && fail "check mode created the deploy user"
in_container 'test -e /srv/notes' && fail "check mode created the app folder"
in_container 'test -e /etc/ssh/sshd_config.d/60-softure-host-deploy.conf' && fail "check mode wrote the sshd drop-in"

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

step "the sshd drop-in admits the deploy user next to the server's own AllowUsers"
in_container 'cat /etc/ssh/sshd_config.d/60-softure-host-deploy.conf' | grep -qx 'AllowUsers deploy' || fail "no AllowUsers drop-in"
[ "$(in_container '/usr/sbin/sshd -T -C user=deploy,host=localhost,addr=127.0.0.1 | grep ^allowusers | sort | tr "\n" " "')" = "allowusers deploy allowusers root " ] \
  || fail "sshd does not allow deploy and root"

step "a real login with the issued key runs deploy.sh"
[ "$(login "$work/key-a")" = "deploy.sh ran: status" ] || fail "login with the issued key"

step "softure-host survey reads the server and changes nothing"
mkdir -p "$HOME/.ssh"
ssh-keyscan -p "$port" 127.0.0.1 2> /dev/null >> "$HOME/.ssh/known_hosts" || fail "ssh-keyscan"
printf 'server: { host: 127.0.0.1, port: %s, adminUser: root, identityFile: %s, deployUser: deploy }\nedge: { manage: false, network: edge }\n' \
  "$port" "$work/admin-key" > "$work/inventory.yml"
(cd "$repo" && npx tsx "$package/src/cli/main.ts" survey --inventory="$work/inventory.yml") > "$work/survey.log" 2>&1 || {
  cat "$work/survey.log" >&2
  fail "survey"
}
cat "$work/survey.log"
grep -q '^system: root is root$' "$work/survey.log" || fail "survey: admin rights"
grep -q '^users: deploy (deploy user): no sudo; groups deploy, docker$' "$work/survey.log" || fail "survey: deploy user"
grep -q '^sshd: AllowUsers deploy, root; AllowGroups none (effective, sshd -T)$' "$work/survey.log" || fail "survey: sshd"
grep -q '^docker: not installed$' "$work/survey.log" || fail "survey: docker"
grep -q '^apps: folders under /srv: /srv/notes$' "$work/survey.log" || fail "survey: app folders"
recap="$(converge "$work/key-a")"
case "$recap" in
  *" changed=0 "*) ;;
  *) fail "a run after the survey changed something: $recap" ;;
esac

step "a deploy.sh the releases replaced is never overwritten"
in_container 'echo "# replaced by a release" >> /srv/notes/deploy.sh'
converge "" > /dev/null
in_container 'grep -q "replaced by a release" /srv/notes/deploy.sh' || fail "deploy.sh was overwritten"

step "rotation replaces the line: the old key is refused, the new one logs in"
converge "$work/key-b" > /dev/null
[ "$(in_container 'grep -c " notes-release$" /home/deploy/.ssh/authorized_keys')" = "1" ] || fail "rotation duplicated the line"
login "$work/key-a" > /dev/null 2>&1 && fail "the old key still logs in"
[ "$(login "$work/key-b")" = "deploy.sh ran: status" ] || fail "login with the rotated key"

step "operator keys: lines of another app and a line added by hand stay as they are"
(cd "$repo" && npx tsx "$package/scripts/e2e-operator-vars.ts" present x "$work/key-blog" > /dev/null)
(cd "$repo" && npx tsx "$package/scripts/e2e-operator-vars.ts" present x "$work/key-hand" > /dev/null)
blog_line="command=\"/srv/blog/deploy.sh\",restrict $(cut -d' ' -f1,2 "$work/key-blog.pub") blog-release"
hand_line="$(cut -d' ' -f1,2 "$work/key-hand.pub") added-by-hand"
in_container "printf '%s\n%s\n' '$blog_line' '$hand_line' >> /home/deploy/.ssh/authorized_keys"
other_lines > "$work/others.before"

step "operator add-key twice with the same label leaves one line: $(operator present laptop "$work/key-op")"
recap="$(operator present laptop "$work/key-op")"
case "$recap" in
  *" changed=0 "*) ;;
  *) fail "a second add-key with the same key changed something" ;;
esac
[ "$(in_container 'grep -c " notes-operator-laptop$" /home/deploy/.ssh/authorized_keys')" = "1" ] || fail "not exactly one operator line"
in_container 'grep " notes-operator-laptop$" /home/deploy/.ssh/authorized_keys' \
  | grep -q '^command="/srv/notes/deploy.sh",restrict ssh-ed25519 [A-Za-z0-9+/=]* notes-operator-laptop$' \
  || fail "the operator line is not bound to deploy.sh with restrict"
other_lines | cmp -s - "$work/others.before" || fail "add-key changed another line"
[ "$(in_container 'stat -c "%U %a" /home/deploy/.ssh/authorized_keys')" = "deploy 600" ] || fail "authorized_keys owner or mode"

step "the operator key runs deploy.sh and nothing else"
[ "$(login "$work/key-op")" = "deploy.sh ran: status" ] || fail "login with the operator key"
[ "$(login "$work/key-op" 'echo shell; id')" = "deploy.sh ran: echo shell; id" ] || fail "a command reached a shell"
[ "$(login "$work/key-op" - < /dev/null)" = "deploy.sh ran: none" ] || fail "a login without a command reached a shell"

step "--check reports the change and changes nothing"
in_container 'md5sum /home/deploy/.ssh/authorized_keys' > "$work/sum.before"
recap="$(operator present ci "$work/key-ci" --check)"
case "$recap" in
  *" changed=1 "*) ;;
  *) fail "check mode did not report the line it would add: $recap" ;;
esac
grep -q 'notes-operator-ci' "$work/operator.log" || fail "check mode did not show the line"
in_container 'md5sum /home/deploy/.ssh/authorized_keys' | cmp -s - "$work/sum.before" || fail "check mode changed authorized_keys"

step "a key another line holds is refused"
for taken in "laptop2:$work/key-op" "dup:$work/key-b" "blog:$work/key-blog" "hand:$work/key-hand"; do
  if operator present "${taken%%:*}" "${taken#*:}" > /dev/null 2> "$work/refusal.log"; then fail "a taken key was accepted as ${taken%%:*}"; fi
  grep -q "already in /home/deploy/.ssh/authorized_keys as" "$work/refusal.log" || fail "the refusal does not name the other line"
done
in_container 'md5sum /home/deploy/.ssh/authorized_keys' | cmp -s - "$work/sum.before" || fail "a refused key changed authorized_keys"

step "a second label with its own key, then remove-key removes only its line"
operator present ci "$work/key-ci" > /dev/null
[ "$(login "$work/key-ci")" = "deploy.sh ran: status" ] || fail "login with the second operator key"
operator absent laptop > /dev/null
[ "$(in_container 'grep -c " notes-operator-" /home/deploy/.ssh/authorized_keys')" = "1" ] || fail "remove-key removed the wrong lines"
other_lines | cmp -s - "$work/others.before" || fail "remove-key changed another line"
login "$work/key-op" > /dev/null 2>&1 && fail "a removed operator key still logs in"
recap="$(operator absent laptop)"
case "$recap" in
  *" changed=0 "*) ;;
  *) fail "removing a missing line changed something" ;;
esac
operator absent ci > /dev/null

step "a run without a key refuses an app that has no line"
in_container 'sed -i "/ notes-release$/d" /home/deploy/.ssh/authorized_keys'
if converge "" > /dev/null 2> "$work/refusal.log"; then fail "a run without a key accepted an app without a line"; fi
grep -q -- "--rotate-key" "$work/refusal.log" || fail "the refusal does not point at --rotate-key"

step "an AllowGroups that would still refuse the deploy user stops the run before any change"
in_container 'echo "AllowGroups admins" > /etc/ssh/sshd_config.d/10-groups.conf'
before="$(in_container 'sha256sum /etc/ssh/sshd_config.d/* /home/deploy/.ssh/authorized_keys')"
for mode in --check ""; do
  if converge "$work/key-a" "$mode" > /dev/null 2> "$work/refusal.log"; then fail "AllowGroups was accepted ($mode)"; fi
  grep -q "sshd would turn the deploy user deploy away (AllowGroups (admins) has none of its groups (deploy docker))" "$work/refusal.log" \
    || fail "the refusal does not name AllowGroups ($mode)"
  [ "$(in_container 'sha256sum /etc/ssh/sshd_config.d/* /home/deploy/.ssh/authorized_keys')" = "$before" ] || fail "a refused run changed the server ($mode)"
done
in_container 'rm /etc/ssh/sshd_config.d/10-groups.conf'

step "a deploy user with sudo rights is refused before any change, in check mode and in a real run"
converge "$work/key-a" > /dev/null
in_container 'echo deploy:secret | chpasswd && usermod -aG sudo deploy'
snapshot() {
  in_container 'getent shadow deploy; id -nG deploy; sha256sum /home/deploy/.ssh/authorized_keys /srv/notes/deploy.sh'
}
before="$(snapshot)"
for mode in --check ""; do
  if converge "$work/key-b" "$mode" > /dev/null 2> "$work/refusal.log"; then fail "a sudo deploy user was accepted ($mode)"; fi
  grep -q "The deploy user deploy has sudo rights (deploy is in the sudo group)" "$work/refusal.log" \
    || fail "the refusal does not name the sudo group ($mode)"
  [ "$(snapshot)" = "$before" ] || fail "a refused run changed the server ($mode)"
done
in_container 'passwd -S deploy' | grep -q ' P ' || fail "a refused run locked the deploy user's password"

step "PASS"
