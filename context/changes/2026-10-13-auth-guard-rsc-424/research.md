---
change_id: auth-guard-rsc-424
---

# Research: auth-guard-rsc-424

Sources: `modules/auth/src/proxy/index.ts`, `modules/auth/tests/guard.test.ts`, `modules/auth/README.md`,
`modules/analytics/src/proxy/index.ts`, issue #424.

- `createAuthGuard` (proxy/index.ts) sets `login.searchParams.set("next", `${url.pathname}${url.search}`)`; `url.search`
  is the raw query, so `_rsc=abc` lands in `next=` unchanged. Both redirect forms (absolute and `relative`) share that
  line, so one fix covers both.
- Next's router adds `_rsc=<hash>` to client navigations and prefetches as a cache-busting key; the parameter has no
  meaning for a page and is never part of a link a user would share.
- `modules/analytics/src/proxy/index.ts` notes that Next strips the `RSC` header and `_rsc` before the proxy in the
  version it was written against; the adopting app in the issue still sees `_rsc`, so the guard cannot rely on that.
  Dropping it is a no-op where Next already removed it.
- Existing tests assert exact `Location` values with other query parameters (`?tab=invoices`, `?tab=1`); they pin
  that the rest of the query is kept and encoded once.
- `URLSearchParams.toString()` re-encodes (`%20` → `+`, `a` → `a=`), so removing the key through `URLSearchParams`
  would rewrite parameters the app reads. Filtering the raw `&`-separated segments keeps them byte for byte.
