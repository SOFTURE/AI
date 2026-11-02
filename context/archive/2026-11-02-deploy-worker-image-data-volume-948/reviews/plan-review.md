---
change_id: deploy-worker-image-data-volume-948
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (c9380e5).

- Scope: all four proposals of the issue are covered; the free-space part is satisfied by the existing health route
  check, which is the issue's own hint ("the files health check already reports it").
- Compatibility: every new flag, input and key is off by default; the templates' default output must stay byte for
  byte the same (the e2e app and the existing snapshot-like tests guard this).
- Safety: every new value is pattern-checked before it reaches YAML or bash; tar paths are relative plain segments
  (no `..`), run inside the app container with the volume, written to the backup folder through a hidden file first.
- Refusing `prebuilt-image` and `e2e` with `worker-dockerfile` is explicit and testable; a follow-up can add a
  prebuilt worker digest if an app needs it.
- Bash 3.2: no associative arrays; the retention uses `ls`/`sort` common to BSD and GNU.

Verdict: approved, no changes.
