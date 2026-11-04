---
change_id: deploy-backup-data-missing-folder-1001
verdict: approved
---

# Implementation review

Reviewed the diff of fd4967f..c6ef4a1 against plan.md and the issue's proposals.

- Template: `back_up_data` runs one `--entrypoint sh app` container that prints the listed paths that exist
  (`[ -e ]`, deviation from the plan's `[ -d ]` recorded under Decisions), then tar archives only those. The step
  line is `<archive>`, `<archive> (skipped <paths>)` or `skipped <paths>`; a failed listing or tar fails the step and
  nothing restarts. The host side uses indexed arrays, `grep -qxF` and a here-string, all in bash 3.2; the
  container side is POSIX `sh` (busybox and glibc images).
- Tests: the fake docker runs the template's own listing script over a test-owned volume folder. New cases: empty
  volume (release passes, no tar call), one of two folders present (only it archived, the other named), a file at a
  listed path (archived, not skipped), a failed listing (release stops). The first, second and fourth failed on
  master; the deploy suite passes (878 tests).
- Compatibility: with every folder present, the tar command and the step line are the same as in 0.5.0 (the
  existing #948 tests pass unchanged apart from creating their folders). The e2e app sets no data volume, so its
  committed `deploy.sh` is unchanged.
- Docs: CHANGELOG Unreleased with the migration for 0.5.0 apps; README data backup paragraph.

Verdict: approved.
