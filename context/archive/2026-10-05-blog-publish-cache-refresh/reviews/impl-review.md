# Implementation review: blog-publish-cache-refresh

Reviewed: commits 18038db and cdad765 plus the follow-up in the archive commit, against plan.md and
plan-review.md (author's review, `--auto`). Verdict: approve. Findings: 0 critical, 2 warning, 2 suggestion.

## Evidence

- Unit: `tests/next/refresh.test.ts` (7: 204 and `revalidateTag("softure-blog", { expire: 0 })`, 401 for
  five wrong shapes, 429 per address with `retry-after`, a shared count for unidentified callers, 503 without
  the secret in the log, 500 for an unset or short secret, named setup errors),
  `tests/discovery/refresh.test.ts` (6), `tests/cli.test.ts` (refresh before IndexNow, `--app-url`, a 401
  as a warning with exit 0, usage errors), `tests/module.test.ts` (route, bucket, env).
- e2e on the built example (PostgreSQL 16, `next start`): `e2e/blog-refresh.serial.spec.ts` passes (2 tests).
  Negative control: the same spec with the secret withheld from the command fails on the page, which still
  serves the old body from the cache (the refresh, not a missing cache, makes the spec pass; plan review W1).
- Gates: `npm run typecheck`, `npm run lint`, `npm test` (245 files, 3312 tests), `npm run build`: green.

## Findings

### W1 [WARNING] The command's request had no client address
**Where:** `src/next/refresh.ts`, found while running the e2e.
**Problem:** the first version answered 400 when `identifyClient` placed no address, as mcp-access does.
The command often calls the app past the proxy that sets the client header (the e2e on localhost, a
container on `--app-url http://web:3000`), so every such refresh would fail.
**Decision:** Fixed - unidentified callers share one rate limit key (`unidentified`); a test covers the
shared count. Cost: someone who reaches the origin directly can use up that shared count; the refresh then
fails as a warning and the app shows the change after `revalidateSeconds`, as before this change.

### W2 [WARNING] A short secret surfaced only on the commit
**Where:** `requestBlogRefresh`.
**Problem:** a dry run printed the address with a secret the commit would refuse.
**Decision:** Fixed - the length check runs before the dry run; the test covers both.

### S1 [SUGGESTION] `--app-url` keeps the origin only
**Decision:** Accepted - a path in the value is dropped (`http://web:3000/x` → `http://web:3000`); the
route's path is the manifest's `routes.refresh`. The README says "origin".

### S2 [SUGGESTION] Several instances
**Decision:** Accepted as documented in the README §12 (plan review S2).

## Plan deviations

- The route counts unidentified callers under one key instead of answering 400 (W1).
- `requestBlogRefresh` is exported from `@softure-ai/blog/server` beside `submitBlogChanges`, not from the
  root entry; the root entry exports `BLOG_RATE_LIMIT_BUCKETS`, as other modules do.

## Gaps

None for the roadmap.
