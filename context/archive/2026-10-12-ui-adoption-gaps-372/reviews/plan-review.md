---
change_id: ui-adoption-gaps-372
reviewed: 2026-10-12
verdict: approved
---

# Plan review: ui-adoption-gaps-372

Checked plan.md against change.md, research.md, issue #372 and the four source files.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `index.ts` uses `export *` from `external-link.js`; if that module re-exported `getExternalRel` too, the same name would come through a client module. Export `getExternalRel` only from the server-safe module. | Taken into Phase 1. |
| 2 | Warning | The architecture test forbids inline copy; `ServerExternalLink` must take the note from `getCopy`, not a literal. | Taken into Phase 1. |
| 3 | Check | Defaults unchanged for all four options, so existing #319 tests stay as they are. | No change. |
| 4 | Check | `closeOutsideOn: "click"` keeps the keyboard focus-out close and the link-click close. | No change. |

No Critical findings.
