---
change_id: deploy-backup-data-missing-folder-1001
title: "deploy: backup-data skips a data.backupPaths folder that does not exist yet (issue #1001)"
status: archived
roadmap_item: null
issue: 1001
branch: claude/project-thread-me5ndz
created: 2026-11-03
updated: 2026-11-03
archived_at: 2026-11-03
---

## Intent

Close [issue #1001](https://github.com/SOFTURE/AI/issues/1001). `deploy.sh` (deploy 0.5.0, #948) archives the data
volume's folders listed in `deploy.json` `data.backupPaths` right after the database backup. On the first release the
named volume is new and empty, so a listed folder does not exist, `tar` exits non-zero and the release ends with
`result|failed|backup-data|…` before the app ever starts. A folder that does not exist holds nothing to lose: skip it,
say so in the step line, and archive the rest.

## Context

Labels: `bug`, `pkg: deploy`. No release in this change: the coordinator releases in the next combined release.

## Constraints

- A folder that exists but cannot be read still fails the release (the backup must not silently shrink).
- Nothing in an app's repository changes; the CHANGELOG carries the migration (re-run `init --force` or copy the
  function).

## Notes

- Framing: skipped. The issue names the problem, the failing output and the fix.
