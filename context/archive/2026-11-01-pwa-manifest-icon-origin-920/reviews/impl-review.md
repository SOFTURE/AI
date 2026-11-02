---
change_id: pwa-manifest-icon-origin-920
reviewed: 2026-11-01
verdict: approved
---

# Implementation review: pwa-manifest-icon-origin-920

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | WARNING | The TypeScript union lets `timeoutMs` through on a cache-first entry. | Refused at build time by `resolveServiceWorkerConfig`, tested. |
| F2 | SUGGESTION | A network-first entry that stores waits for the cache put before answering. | Kept: the same as cache first today; the put is local and small. |
| F3 | SUGGESTION | The key rule exists twice (page helper and worker body), since the worker cannot import. | Held together by a test that fills the cache with the helper and reads it through the worker. |

Gates: typecheck, ESLint, the language gate, `modules/pwa` tests (198) green.
