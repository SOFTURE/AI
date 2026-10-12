---
change_id: core-formatters-410
reviewed: 2026-10-12
verdict: approved
---

# Plan review: core-formatters-410

Checked plan.md against change.md, research.md, issue #410 and the core sources.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The language gate scans tests and `context/`: Polish expected strings with diacritics outside a message dictionary or a `pl/` folder fail `lint:language`. | Taken into Phase 1: expected Polish strings use `\u` escapes, as `format.test.ts` does. |
| 2 | Warning | `formatDuration` copy must sit in `messages/{en,pl}.ts`, and pl must match en's shape (`CoreMessages`), including plural keys pl needs (`few`, `many`). | Taken into Phase 1. |
| 3 | Check | `memoizeByContent` lives in the main entry, so no `node:crypto`; an exact serialized key avoids collisions anyway. | No change. |
| 4 | Check | `landingOrigin` always filled keeps `SoftureConfig` consumers simple; no literal configs exist outside `defineSoftureConfig`. | No change. |

No Critical findings.
