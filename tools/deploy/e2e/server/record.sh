#!/bin/sh
# The recorder of deploy-app.yml's end-to-end server (DF-3; forced-command.sh runs it before deploy.sh, DF-15). It takes
# what the deploy job sends, the command line in SSH_ORIGINAL_COMMAND and the release archive on stdin, and records it
# into RECEIVED_DIR for check-received.sh: the command line, the archive's files, each file's SHA-256 (not .env.prod's
# or .registry-token's), the modes .env.prod and .registry-token have in the archive and the names in .env.prod. The
# values of .env.prod and the token are never written.
set -eu

received="${RECEIVED_DIR:?}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
archive="$work/release.tar.gz"

cat > "$archive"
if [ ! -s "$archive" ]; then
  echo "e2e server: stdin was empty; expected the release archive." >&2
  exit 1
fi
if ! tar -tzf "$archive" > /dev/null 2>&1; then
  echo "e2e server: stdin is not a gzip tar archive." >&2
  exit 1
fi
mkdir "$work/release"
tar -xzf "$archive" -C "$work/release"

printf '%s\n' "${SSH_ORIGINAL_COMMAND:-}" > "$received/command"
(cd "$work/release" && find . -type f | LC_ALL=C sort) > "$received/files"
(cd "$work/release" && find . -type f ! -path ./.env.prod ! -path ./.registry-token | LC_ALL=C sort | while IFS= read -r file; do
  sha256sum "$file"
done) > "$received/sha256"
tar -tvzf "$archive" | awk '$NF == "./.env.prod" { print $1 }' > "$received/env-mode"
tar -tvzf "$archive" | awk '$NF == "./.registry-token" { print $1 }' > "$received/token-mode"
if [ -f "$work/release/.env.prod" ]; then
  sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' "$work/release/.env.prod" | LC_ALL=C sort > "$received/env-names"
else
  : > "$received/env-names"
fi
echo "e2e server: recorded $(wc -l < "$received/files" | tr -d ' ') files for '${SSH_ORIGINAL_COMMAND:-}'."
