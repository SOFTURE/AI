#!/usr/bin/env bash
# Checks the release body deploy-report.yml wrote on the end-to-end test (DF-10, the `assert` job of e2e-deploy.yml):
# the fixture's owner text still opens the body, the status section lists each job of deploy-app.yml with the result
# the test expects (verify is skipped there), and the deployments section has one row, `deployed`, with the image the
# deploy job built. The expectations come from the caller, not from the deploy CLI. Prints one `ok:` line per check and
# every failure.
set -euo pipefail

: "${BODY_FILE:?}" "${IMAGE:?}"

failures=0
pass() { echo "ok: $1"; }
fail() {
  echo "::error::deploy e2e report: $1"
  failures=$((failures + 1))
}

if [ ! -f "$BODY_FILE" ]; then
  echo "::error::deploy e2e report: no release body at $BODY_FILE; did the report job run?"
  exit 1
fi

# The text between a section's markers.
section() {
  awk -v opening="<!-- softure-deploy:$1 -->" -v closing="<!-- /softure-deploy:$1 -->" \
    '$0 == opening { inside = 1; next } $0 == closing { inside = 0 } inside' "$BODY_FILE"
}

if [ "$(head -n 1 "$BODY_FILE")" = "Release text written by the owner." ]; then
  pass "the owner's text opens the body"
else
  fail "the body does not start with the owner's text"
fi

status="$(section status)"
for row in "check|✅ success" "build|✅ success" "deploy|✅ success" "verify|⏭️ skipped"; do
  expected="| ${row%%|*} | ${row#*|} |"
  if grep -qxF -- "$expected" <<< "$status"; then
    pass "status row '$expected'"
  else
    fail "the status section has no row '$expected'"
  fi
done

deployments="$(section deployments)"
rows="$(grep -c '^| [0-9]' <<< "$deployments" || true)"
if [ "$rows" = "1" ]; then
  pass "one deployment row"
else
  fail "the deployments section has $rows rows, expected 1"
fi
if grep -q "| ✅ deployed | " <<< "$deployments" && grep -qF -- "\`$IMAGE\`" <<< "$deployments"; then
  pass "the row says deployed with $IMAGE"
else
  fail "the deployment row does not say deployed with $IMAGE"
fi

if (( failures > 0 )); then exit 1; fi
