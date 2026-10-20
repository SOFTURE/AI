---
change_id: deploy-script-handoff-621
---

# Research: the release runs its own deploy.sh (issue #621)

## Where it happens

- `tools/deploy/templates/docker/server/deploy.sh.tmpl`, `deploy <tag>`: takes `.deploy.lock` (`exec 9>` + `flock`),
  reads the archive from stdin into the run's temporary folder, unpacks it into `releases/<tag>/`, checks it, then
  `install_release` copies the files and installs the release's `deploy.sh` by a rename. Everything after that (the
  switch's `compose up ... {{switchServices}}`, cron, hooks) is the running, old copy.
- `{{switchServices}}` is `getSwitchServices` in `src/init/generate.ts`: `traefik` (unless `--edge`), `app`, and
  `worker` with `@softure-ai/jobs`. Postgres starts at its own step; `migrate` through `depends_on`.
- `APP_DIR` is the script's own folder (`BASH_SOURCE`); the script `cd`s there.
- `tests/server-files.test.ts` runs the rendered script with stub `docker`, `npx`, `flock`, `crontab` against
  archives packed by the action's real pack step. Every release there ships the same script.
- `e2e/app/docker/server/deploy.sh` is a committed render (`npm run e2e-app`); `tests/e2e-scripts.test.ts` fails when
  it and `init` disagree.

## Options (the issue's three)

1. **Hand off to the shipped script.** After the archive is unpacked and checked, and before any step line or
   change, a running script whose release ships a different `deploy.sh` runs that one with the same command and the
   same archive on stdin, and exits with its status. The new copy does the whole release itself (its own step lines,
   restore and result). Covers every script change, not only the service list.
   - Older shipped scripts take `APP_DIR` from their own path and reopen the lock: run from anywhere but `/srv/<name>/`
     they would break, and the reopen would wait on the parent's lock. So hand off only to a script that declares it
     understands the hand-off (it reads the variable that carries the app folder); others (a rollback to an old tag)
     run as today.
   - Lock: a child that inherits fd 9 and calls `flock` on it again shares the parent's open file description, so the
     lock is kept without a gap; it must not reopen fd 9.
   - Running the copy from the release folder would let the child's own unpack replace the file it is reading; run a
     copy in the parent's temporary folder instead, which the parent removes after the child exits.
2. **`compose up` without a service list.** Starts `migrate` and `postgres` explicitly too, and every service of an
   app-owned compose file that is only meant for `compose run`; `--wait` on a one-shot service depends on the Compose
   release. Only fixes the service list, and only once the running script has it.
3. **Fail when a service has no container.** False failures for run-only services in an app's compose file; still
   needs the running script to have the check.

Any fix lives in the script, so it takes effect from the release after the one that installs it: the release that
moves an app to the fixed script is still run by its old copy.

## Recommendation

Option 1. It makes "a release runs the script it ships" true for every later change, needs no knowledge of the
compose file, and keeps the old behaviour for scripts that cannot take the hand-off.
