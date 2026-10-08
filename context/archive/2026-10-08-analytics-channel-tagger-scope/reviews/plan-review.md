# Plan review: analytics-channel-tagger-scope

Reviewed: plan.md against change.md, issue #242 and the code (`modules/analytics/src/proxy/index.ts`,
`src/server/channel.ts`, `tests/support.ts`, README §4). Verdict: **ready after the fixes below** (applied).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | Warning | D3 took the scheme from `request.url`. Behind a TLS-terminating proxy that forwards a `Host` the app did not configure and a framework that builds `request.url` from `Host`, the 307 would downgrade the visitor to `http://`. | Accepted: the scheme comes from the first `X-Forwarded-Proto` value when it is `http`/`https`, as `readPublicOrigin` already does for configured origins; test added to the plan. |
| F2 | Suggestion | `targets` scopes only `tag`; a reader may expect `carry` to follow it. | Accepted: the README says `carry` is unscoped because it adds no request (it rewrites a redirect another piece already answered with). |
| F3 | Suggestion | `<ChannelKeeper />` still puts the tag back in the address bar on any page; `targets` does not change the browser. | Accepted: one README sentence; scoping the keeper stays out of scope (not asked). |
| F4 | Check | Open redirect through `Host` | None: the new branch is taken only when `Host` equals the request URL's own host, so the target is the host the request was sent to; the `//elsewhere` path test stays. |
| F5 | Check | Backward compatibility | Holds: `targets` is optional; a request without `Host` resolves exactly as before; the existing proxy tests stay unchanged. |
| F6 | Check | Prefetches | A `<Link>` prefetch to an untargeted path is no longer redirected, which is the point of the scope; targeted paths behave as before. |

No missing phase: one phase covers the option, the host rule, the export, docs and the changelog.
