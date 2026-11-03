---
change_id: deploy-backup-data-missing-folder-1001
status: in_progress
---

# Plan: backup-data skips a listed folder that does not exist yet (issue #1001)

Input: change.md, research.md. Complexity: small (one template function, tests, docs).

## Phase 1: tests first, then the template

1. `tools/deploy/tests/server-files.test.ts`: the fake docker runs the `--entrypoint sh app` listing on the host
   against a test-owned folder (`DATA_VOLUME`) in place of the mount path, so the real listing script is exercised.
   The existing data-backup tests create their folders there. New tests (red on master): a first release with an
   empty volume passes with `step|backup-data|ok|skipped cache/paid exports` and no tar call; with one folder
   present, only it is archived and the step line names the skipped one; a failed listing fails the step.
2. `templates/docker/server/deploy.sh.tmpl`, `back_up_data`: one one-off `sh` container prints which listed folders
   are directories (`[ -d ]`), then tar archives only those. Step detail: `<archive>`, `<archive> (skipped <paths>)`
   or `skipped <paths>` when none exists. A failed listing fails the step (`listing the data folders failed.`); a
   tar failure still fails it as before. Comment updated.
3. `e2e/app/docker/server/deploy.sh`: unchanged (the e2e app sets no data volume); `tests/e2e-scripts.test.ts`
   confirms.

## Phase 2: docs

CHANGELOG `## Unreleased`: the fix and what a 0.5.0 app does (re-run `init --force`, or copy `back_up_data` from a
fresh `init`). README's data backup paragraph: the skipped folders and the step line.

## Decisions (auto)

- Skip, do not create the folders (research.md option 3): a backup step does not write to the volume.
- Two container runs (list, then tar) rather than one script that streams the archive: the skip list must reach the
  step line, and the tar stream owns stdout.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1
- [ ] Phase 2
