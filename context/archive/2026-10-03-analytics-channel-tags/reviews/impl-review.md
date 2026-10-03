# Implementation review: analytics-channel-tags

Reviewed: the branch diff against plan.md (author's review, `--auto`). Gates: typecheck, lint, test
(1674 passed), build, and the example's e2e (62 passed, `analytics-channel.spec.ts` included).
Verdict: approve. Findings: 0 critical, 1 warning (fixed), 1 suggestion (deferred).

### W1 [WARNING] `tag` could leave the app for a path that looks like a host
`new URL(pathname + search, appOrigin)` resolves a request path `//elsewhere.example.com/x` to another host.
**Fixed:** the target is `appOrigin` with the path and query set on it; a unit test covers the path.

### S1 [SUGGESTION] Client navigations are recognised by `Next-Url`
Measured on Next 16.3: the proxy never sees the router's `RSC` header (stripped with `_rsc` before the proxy
runs), so a client navigation counts by the `Next-Url` header; the e2e covers a `next/link` navigation.
**Decision:** Deferred to the followups roadmap as FU-5 (`analytics-client-navigation`); README §12 says so.

Checked without findings: no cookie is read or written (unit and e2e); a URL's own parameter wins, valid or
not, so `tag` cannot loop; only same-origin Referers and Locations count; invalid values are ignored, never
repaired; `softure migrate` loads the config with `/next` imported (lazy `next/headers`); the module has no
schema, so `ops` and the container check list no new health check.
