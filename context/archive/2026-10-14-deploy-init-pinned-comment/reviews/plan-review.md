---
change_id: deploy-init-pinned-comment
reviewed: 2026-10-14
verdict: approved
---

# Plan review: deploy-init-pinned-comment

Checked plan.md against change.md, issue #473, the four templates and `render-template.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Section tags must stand alone on a line, so the sentence before the ref ("another). ...") has to be repeated in both blocks rather than split mid-line. | Taken into Phase 1. |
| 2 | Check | The examples are compared as parsed YAML, so comment changes cannot break the example tests; the new tests read the raw text. | No change. |
| 3 | Check | `workflowsRef` stays a text value for the `uses:` lines; the unpinned block no longer reads it, which the renderer allows. | No change. |
| 4 | Check | README "Which ref callers pin" describes the `uses:` lines, not the comment; it stays as is. | No change. |

No Critical findings.
