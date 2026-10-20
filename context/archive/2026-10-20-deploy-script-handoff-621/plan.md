---
change_id: deploy-script-handoff-621
status: archived
---

# Plan: the release runs its own deploy.sh (issue #621)

Input: change.md, research.md. Complexity: small (one template, its tests, docs).

## Phase 1: the hand-off (TDD)

Files: `tools/deploy/tests/server-files.test.ts`, `tools/deploy/templates/docker/server/deploy.sh.tmpl`,
`tools/deploy/e2e/app/docker/server/deploy.sh` (regenerated).

1. Tests first, in a new `describe` of `server-files.test.ts`:
   - a release whose shipped `deploy.sh` differs (the init render plus a marker line that records its run) is run by
     the shipped copy: one set of step lines, `result|ok`, the shipped script installed, the switch line once, and the
     running copy prints no step line of its own;
   - the shipped copy gets the app folder (files land in `/srv/<name>/`, not next to the copy) and the same command;
   - a failing shipped copy fails the release with its own result line and exit status, and the previous files are
     back (its restore);
   - a shipped `deploy.sh` without the hand-off variable (a script older than this change) is not handed the release:
     the running copy deploys it as before;
   - the same script is not handed off (the existing tests keep their exact step lines and empty stderr).
2. Template: `APP_DIR` from `SOFTURE_DEPLOY_HANDOFF_FROM` when set; `take_lock` keeps an inherited fd 9 when handed
   off; after the archive checks (before the registry token is taken out and before any step line), when not handed
   off and the shipped script differs from `BASH_SOURCE` and reads `SOFTURE_DEPLOY_HANDOFF_FROM`: copy it into the
   run's folder, run it with `SOFTURE_DEPLOY_HANDOFF_FROM="$APP_DIR"`, the same `SSH_ORIGINAL_COMMAND` and the archive on
   stdin, print nothing of its own (`reports_result=""`), exit with its status. A line on stderr says it happened.
   Update the header comment on how the script replaces itself.
3. Regenerate the e2e app (`npm run e2e-app -w @softure-ai/deploy`).

## Phase 2: docs

`tools/deploy/README.md` (`deploy <tag>` step 1/2, Limitations), `tools/deploy/CHANGELOG.md` `## Unreleased` with the
app's migration: take the new `docker/server/deploy.sh` (re-run `init --force` into a scratch folder and copy it, or
apply the template's diff); the release that ships it is still run by the old copy, so it should change nothing else
that needs the new script; and the issue's workaround for an app already hit.

## Decisions (auto)

- Option 1 (hand-off) over 2 and 3 → the bug is "the old script runs the release"; only the hand-off fixes that for
  every future script change, and 2/3 misjudge app-owned compose files.
- Hand off only to a script that reads `SOFTURE_DEPLOY_HANDOFF_FROM` → older scripts take `APP_DIR` from their path
  and reopen the lock; a rollback to them must keep working.
- One variable carries both the app folder and "handed off" → nothing else to keep in sync; sshd's forced command
  does not pass client environment (no `AcceptEnv` for it), so a caller cannot set it.

## Progress

- [x] Phase 1: the hand-off (2e00802)
- [x] Phase 2: docs (82f74eb)

The hand-off test was red against the old template (the running copy switched `traefik app`, no worker). The e2e app
was regenerated. Gates: typecheck, lint (with the language gate), the deploy package's tests (796 passed, 18
skipped) and the repository tests (551 passed).
