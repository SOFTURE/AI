---
change_id: auth-guard-relative-proxy-452
reviewed: 2026-10-13
verdict: approved
---

# Implementation review: auth-guard-relative-proxy-452

Reviewed: the branch diff against plan.md, change.md and issue #452.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: none. The relative branch uses `Response.redirect` on `url.origin`, so `Location` is absolute and Next's adapter parses it; the contract test shows 307 with `/login?next=…` on the wire, as the mode promised. | No change. |
| 2 | Check | `X-Forwarded-Host` is still ignored in relative mode (unit test sends `evil.example`, the Location stays on the request URL's origin). | No change. |
| 3 | Check | The default mode is untouched: the contract test keeps `https://app.example.com/login?next=…` through the adapter (different host, left absolute). | No change. |
| 4 | Check | Plan review finding 1 resolved: the option comment and README say the Location is absolute outside Next and point a reverse-proxied app to the default. | No change. |
| 5 | Check | The adapter is typed locally in the test (`unknown` cast to a narrow interface), no `any`; `AsyncLocalStorage` is set before the dynamic import. | No change. |
| 6 | Check | Docs: option comment, README, CHANGELOG `## Unreleased` (no version bump, batched releases). | No change. |

Gates: see plan.md Progress.
