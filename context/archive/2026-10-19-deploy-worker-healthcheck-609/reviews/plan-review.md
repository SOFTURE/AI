---
change_id: deploy-worker-healthcheck-609
reviewed: 2026-10-19
verdict: approved
---

# Plan review: deploy-worker-healthcheck-609

Checked plan.md against change.md, research.md, issue #609 and the compose template.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | With `init: true` (tini) PID 1 is root-owned; `kill(1, 0)` as `nextjs` throws EPERM and the check fails. | The template sets no `init`, so `node` is PID 1. Say in the README that the check assumes `node worker.mjs` is PID 1. |
| 2 | Minor | The YAML array form must survive the template's quoting (no `{{ }}` inside). | Literal text, pinned by the parsed-compose test. |
| 3 | Check | `--wait` with a starting check waits through `start_period`; 10 s keeps deploys fast. | No change. |
| 4 | Minor | An app's integration compose file has the same `disable: true`. | The CHANGELOG migration names both files. |

No Critical findings.
