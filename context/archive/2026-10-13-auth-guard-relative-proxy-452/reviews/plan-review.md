---
change_id: auth-guard-relative-proxy-452
reviewed: 2026-10-13
verdict: approved
---

# Plan review: auth-guard-relative-proxy-452

Checked plan.md against change.md, research.md, issue #452 and `proxy/index.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Behind a reverse proxy outside Next the request URL can carry an internal host, so the `Location` would name it. Under Next (the documented use) the adapter relativizes a same-host URL, and the mode is meant for stacks the config cannot list. | Document in the option comment and README: outside Next the `Location` is absolute on the request URL's origin; use the default mode behind a proxy. |
| 2 | Warning | The contract test depends on a Next internal path (`next/dist/server/web/adapter.js`), which can move between majors. | Accepted: a move fails loudly at import, and that is the signal to re-check the contract. Typed locally in the test, no `any`. |
| 3 | Check | `_rsc` stripping (#424) runs before the branch and is shared by both modes; the `_rsc` relative test only changes its expected prefix. | No change. |
| 4 | Check | No API change: option name and type stay, the default mode is untouched. | No change. |

No Critical findings.
