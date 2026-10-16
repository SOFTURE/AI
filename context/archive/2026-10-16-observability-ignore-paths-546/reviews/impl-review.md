---
change_id: observability-ignore-paths-546
reviewed: 2026-10-16
verdict: approved
---

# Implementation review: observability-ignore-paths-546

Reviewed: the branch diff against plan.md, change.md and issue #546.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Ignored path, with a query and below it: not exported; `/api/healthz` and other paths: exported. | No change. |
| 2 | Check | A child of a dropped request is dropped through `ParentBased`. | No change. |
| 3 | Check | A bad entry throws at start even without an endpoint, naming `traces.ignorePaths[i]`. | No change. |
| 4 | Check | Without the option no sampler is passed, so the SDK default stays exactly as before. | No change. |
