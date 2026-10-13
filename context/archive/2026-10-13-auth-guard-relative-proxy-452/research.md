---
change_id: auth-guard-relative-proxy-452
---

# Research: auth-guard-relative-proxy-452

Sources: `modules/auth/src/proxy/index.ts`, `modules/auth/tests/guard.test.ts`, `modules/auth/README.md` (route guard
section), `node_modules/next/dist/server/web/adapter.js` and `shared/lib/router/utils/relativize-url.js` (next 16.3.8).

- The guard's relative branch returns `new Response(null, { status: 307, headers: { location: "/login?next=…" } })`.
- Next's `adapter()` reads the handler's `Location` and calls `new NextURL(redirect, …)` without a base: a path-only
  value throws `ERR_INVALID_URL`, so the request answers 500 (reproduced in vitest by calling `adapter()` with a
  handler that returns the guard's response).
- For an absolute `Location` whose host equals the request URL's host, the adapter rewrites it with
  `getRelativeURL(redirectURL, requestURL)`, i.e. to `/login?next=…` (measured: 307, `Location: /login?next=%2Faccount`).
  A different host is left absolute.
- So an absolute URL on `new URL(request.url).origin` keeps the relative mode's on-the-wire behaviour under Next and
  never reads `X-Forwarded-Host` (the existing test sends one and expects it ignored).
- Calling `adapter()` in vitest needs `globalThis.AsyncLocalStorage` set before Next's modules load (Next expects the
  edge runtime global); the module then loads through a dynamic import. `next/dist/...` deep imports already appear in
  other modules' tests (seo, agent-ready).
- Unit tests for the relative mode assert the path-only `Location` (`guard.test.ts`, "relative redirect (#314)" and
  the `_rsc` case); they change to the absolute URL on the request origin.
