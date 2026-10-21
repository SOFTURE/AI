---
change_id: guarded-page-fetch-636
reviewed: 2026-10-21
verdict: approved
---

# Plan review: guarded-page-fetch-636

Checked plan.md against change.md, research.md, issue #636 and `guarded-request.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | A redirect `Location` can carry credentials or another scheme, and a relative one can still name a private host through the base. | Planned: each hop goes through the same URL check as the first URL, after resolving against the hop. |
| 2 | Major | A cap on raw bytes lets a gzip bomb expand past `maxBytes`. | Planned: count decoded bytes; stop the stream at the cap. |
| 3 | Minor | One timer must cover every hop and the body, or a chain of slow redirects multiplies the limit. | Planned: one deadline for the whole fetch. |
| 4 | Minor | The redirect hop's response must be drained or destroyed, or its socket stays open (`agent: false`). | Planned: destroy each 3xx response before the next hop. |
| 5 | Check | `sendGuardedRequest`'s tests pin its behaviour through the refactor. | No change. |
| 6 | Check | `node-html-parser` builds a static tree; no script runs and no resource is loaded. | No change. |

No Critical findings.
