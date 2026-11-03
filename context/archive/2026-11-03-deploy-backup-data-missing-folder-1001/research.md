# Research: deploy-backup-data-missing-folder-1001

## Reproduction (master 4372b17)

`tools/deploy/templates/docker/server/deploy.sh.tmpl`, `back_up_data`: one one-off container
`compose run --rm --no-deps -T --label traefik.enable=false --entrypoint tar app -czf - -C "$DATA_PATH" ./<path>…`.
GNU tar and busybox tar both exit non-zero when a named member does not exist (`Cannot stat: No such file or
directory`), so a fresh volume fails the step, `fail` ends the release with `result|failed|backup-data|the backup of
the data folders failed.`, and nothing restarts. The issue's report is confirmed by reading the code; the test suite
stubs docker, so the existing tests never saw the missing folder.

## Options

1. `tar --ignore-failed-read`: GNU only; busybox tar (alpine images) has no such flag. Rejected.
2. One-off `sh` container that lists which listed folders exist (`[ -d ]`), then tar only those. Two container runs
   when `backupPaths` is set; the step line names the skipped folders. Chosen.
3. Create the missing folders (`mkdir -p`) as the image's user before tar (the issue's optional proposal 2). Not
   chosen: the step is a backup and should not write to the volume; the app creates its own folders when it writes
   (`@softure-ai/files` `createLocalStorage` makes parents), and a mkdir that fails on an older volume owned by root
   would turn a skip into a failed release again.

## Files

- `tools/deploy/templates/docker/server/deploy.sh.tmpl` (`back_up_data` and its comment)
- `tools/deploy/e2e/app/docker/server/deploy.sh` only if it carries the data volume block (it does not: the e2e app
  sets no data volume; `tests/e2e-scripts.test.ts` compares)
- `tools/deploy/tests/server-files.test.ts` (fake docker answers the `sh` listing; tests for some and all missing)
- `tools/deploy/CHANGELOG.md`, `tools/deploy/README.md`
