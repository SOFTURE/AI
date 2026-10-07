---
change_id: analytics-two-origins
reviewed: plan.md
date: 2026-10-07
verdict: approved with fixes applied
---

# Plan review: analytics-two-origins

Checked `plan.md` against `change.md`, issue #210 and the module's channel reader, endpoint, proxy piece, browser
keeper, pixel and counter.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The issue's proposal relies on the `Referer` alone for point 3, but the browser default (`strict-origin-when-cross-origin`) sends only the origin on a cross-origin navigation, so the server never sees `?z=` from the apex. | Accepted: the plan adds link tagging in the browser keeper; README states that a server-only setup needs `Referrer-Policy: no-referrer-when-downgrade` (or looser) on the pages that link across. |
| 2 | Warning | Building a redirect target from `Host` is an open-redirect vector. | Accepted as designed: `Host` only selects a configured origin; a test sends a forged `Host` and expects `appOrigin`. |
| 3 | Warning | `carry` resolving a relative `Location` against an internal `request.url` already produces an internal absolute URL on 0.1.7. | Accepted: fixed in phase 1, the only behaviour change for apps without new options; listed in CHANGELOG. |
| 4 | Suggestion | `ChannelKeeperClient` lists rule fields in its effect dependencies; an `origins` array would be a new identity on every render. | Accepted: the dependency is the joined string. |
| 5 | Suggestion | `origins` may repeat `appOrigin` or each other. | Accepted: the first-party list is de-duplicated. |
| 6 | Suggestion | `isKnownChannel` runs on every tagged count; an expensive hook slows every beacon. | Accepted: README says to keep it to one indexed lookup; it is not called for counts without a channel. |
| 7 | Suggestion | The keeper's link tagging must ignore `mailto:`, `javascript:` and same-origin links (the proxy and keeper already cover those). | Accepted: `tagLink` accepts only http(s) links to another configured origin. |

No finding blocks the plan.
