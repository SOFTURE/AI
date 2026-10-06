#!/usr/bin/env bash
# The forced command of deploy-app.yml's end-to-end server (DF-15, start-server.sh): what a real server's
# authorized_keys runs is the app's deploy.sh itself; this wrapper adds two things a test needs. A `deploy <tag>` call
# is first recorded by record.sh (what check-received.sh asserts), then the same archive goes to the app folder's
# deploy.sh with SSH_ORIGINAL_COMMAND untouched. Other commands (status) go to deploy.sh as they are.
#
# deploy.sh calls `npx @softure-ai/deploy@<version>`; the version of the committed e2e app is never published, so
# bin/npx answers that call with the CLI built from the tag (DEPLOY_CLI). Node comes from the job's setup-node, which
# sshd's environment does not know. $1 is the env file start-server.sh wrote (APP_DIR, NODE_BIN, DEPLOY_CLI,
# RECEIVED_DIR).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${1:?the env file of start-server.sh}"
export PATH="$here/bin:$NODE_BIN:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export SOFTURE_DEPLOY_E2E_CLI="$DEPLOY_CLI"

if [[ "${SSH_ORIGINAL_COMMAND:-}" != deploy\ * ]]; then
  exec "$APP_DIR/deploy.sh"
fi

archive="$(mktemp)"
trap 'rm -f "$archive"' EXIT
cat > "$archive"
# The recorder's lines go to stderr: only deploy.sh's own lines (step|…, result|…) are the server's answer.
RECEIVED_DIR="$RECEIVED_DIR" sh "$here/record.sh" < "$archive" >&2
"$APP_DIR/deploy.sh" < "$archive"
