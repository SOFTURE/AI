---
change_id: deploy-backup-data-missing-folder-1001
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (4372b17).

- Scope: the issue's proposals 1 and 3 are covered (skip and report a missing folder; a first-release test with an
  empty volume). Proposal 2 (create the folders) is declined with a reason in research.md; the app creates its own
  folders when it writes.
- Safety: only a folder that is not a directory is skipped; a listing or tar failure still stops the release before
  anything restarts, so an unreadable folder cannot shrink the backup silently.
- The fake docker runs the real listing script, so the test guards the template's shell, not a stubbed answer.
- Portability: `[ -d ]`, `printf` and `sh -c` work in busybox and glibc images; the host side stays within bash 3.2
  (indexed arrays, `grep -qxF`).
- Compatibility: an app whose folders all exist sees the same step line and the same tar command as in 0.5.0.

Verdict: approved, no changes.
