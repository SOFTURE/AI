#!/usr/bin/env bash
# Checks what the throwaway SSH server of deploy-app.yml's end-to-end test recorded (server/record.sh) against the tag
# (DF-3, the `assert` job of e2e-deploy.yml). Run from the tag's checkout: COMPOSE_FILE, SERVER_SCRIPT and
# DEPLOY_CONFIG are the paths the workflow was called with. The expectations come from the tag and the caller, not
# from the deploy CLI: the command line is `deploy <tag>`, the image `<expected image>:<tag>`, the archive holds the
# compose file's folder, deploy.sh, deploy.json, .env.prod and .registry-token (both 0600) and nothing else, each shipped
# file is byte for byte the tag's, and .env.prod holds exactly EXPECTED_ENV_NAMES. Prints one `ok:` line per check and every failure.
set -euo pipefail

: "${RECEIVED_DIR:?}" "${COMPOSE_FILE:?}" "${SERVER_SCRIPT:?}" "${DEPLOY_CONFIG:?}"
: "${TAG:?}" "${IMAGE:?}" "${EXPECTED_IMAGE:?}" "${EXPECTED_ENV_NAMES:?}"

failures=0
pass() { echo "ok: $1"; }
fail() {
  echo "::error::deploy e2e: $1"
  failures=$((failures + 1))
}

for name in command files sha256 env-mode token-mode env-names; do
  if [ ! -f "$RECEIVED_DIR/$name" ]; then
    echo "::error::deploy e2e: the server recorded no $name; did the forced command run?"
    exit 1
  fi
done

prod_dir="${COMPOSE_FILE%/*}"

# The tag's file behind a name in the archive (`./deploy.sh`, `./initdb/01-roles.sql`).
tag_file() {
  case "$1" in
    ./deploy.sh) echo "$SERVER_SCRIPT" ;;
    ./deploy.json) echo "$DEPLOY_CONFIG" ;;
    *) echo "$prod_dir/${1#./}" ;;
  esac
}

command_line="$(cat "$RECEIVED_DIR/command")"
if [ "$command_line" = "deploy $TAG" ]; then
  pass "command line is 'deploy $TAG'"
else
  fail "command line was '$command_line', expected 'deploy $TAG'"
fi

if [ "$IMAGE" = "$EXPECTED_IMAGE:$TAG" ]; then
  pass "image is $IMAGE"
else
  fail "image was '$IMAGE', expected '$EXPECTED_IMAGE:$TAG'"
fi

expected_files="$({
  (cd "$prod_dir" && find . -type f)
  printf '%s\n' ./deploy.sh ./deploy.json ./.env.prod ./.registry-token
} | LC_ALL=C sort)"
received_files="$(cat "$RECEIVED_DIR/files")"
if [ "$received_files" = "$expected_files" ]; then
  pass "files are the compose folder, deploy.sh, deploy.json, .env.prod and .registry-token"
else
  # Both sides sorted the same way, so comm needs no GNU-only --nocheck-order (macOS runs this script in the tests).
  received_sorted="$(LC_ALL=C sort <<< "$received_files")"
  missing="$(LC_ALL=C comm -23 <(echo "$expected_files") <(echo "$received_sorted") | paste -sd ' ' -)"
  extra="$(LC_ALL=C comm -13 <(echo "$expected_files") <(echo "$received_sorted") | paste -sd ' ' -)"
  fail "files differ from the tag's: missing [${missing}], unexpected [${extra}]"
fi

hash_failures=0
hashed=0
while read -r hash name; do
  hashed=$((hashed + 1))
  file="$(tag_file "$name")"
  if [ ! -f "$file" ]; then
    fail "$name has no file in the tag ($file)"
    hash_failures=$((hash_failures + 1))
  elif [ "$(sha256sum < "$file" | cut -d' ' -f1)" != "$hash" ]; then
    fail "$name differs from the tag's $file"
    hash_failures=$((hash_failures + 1))
  fi
done < "$RECEIVED_DIR/sha256"
# .env.prod and .registry-token are not hashed: their values differ from anything in the tag.
expected_hashed=$(($(grep -c . <<< "$expected_files") - 2))
if (( hash_failures == 0 && hashed == expected_hashed )); then
  pass "each of the $hashed shipped files equals the tag's"
elif (( hash_failures == 0 )); then
  fail "the server hashed $hashed files, expected $expected_hashed"
fi

env_mode="$(cat "$RECEIVED_DIR/env-mode")"
if [ "$env_mode" = "-rw-------" ]; then
  pass ".env.prod mode is 0600 in the archive"
else
  fail ".env.prod mode was '${env_mode:-missing}' in the archive, expected -rw-------"
fi

token_mode="$(cat "$RECEIVED_DIR/token-mode")"
if [ "$token_mode" = "-rw-------" ]; then
  pass ".registry-token mode is 0600 in the archive"
else
  fail ".registry-token mode was '${token_mode:-missing}' in the archive, expected -rw-------"
fi

expected_names="$(tr ' ' '\n' <<< "$EXPECTED_ENV_NAMES" | grep . | LC_ALL=C sort)"
received_names="$(cat "$RECEIVED_DIR/env-names")"
if [ "$received_names" = "$expected_names" ]; then
  pass "env names are ${EXPECTED_ENV_NAMES}"
else
  fail "env names were [$(paste -sd ' ' - <<< "$received_names")], expected [${EXPECTED_ENV_NAMES}]"
fi

if (( failures > 0 )); then
  echo "deploy e2e: $failures check(s) failed."
  exit 1
fi
echo "deploy e2e: what the server received matches the tag."
