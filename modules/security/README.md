# @softure-ai/security

**Status:** wave 1 · not implemented · depends on: core, db

Rate limiting (fixed window, atomic `INSERT … ON CONFLICT`, probabilistic cleanup) with buckets
from configuration. Pluggable IP resolver: `cloudflareIp()`, `forwardedForIp({ trustedProxies })`
or your own. A `readSmallBody` helper (request body size cap).

**Tables:** `security.rate_limits(bucket, identifier, attempts, window_started_at)`

**Source in FIRE_TRACKER:** `src/db/auth-attempts.ts` (+ test), `rateLimitKey` in `src/app/actions/do-auth.ts`
and `src/app/api/mcp/route.ts`, `src/lib/read-small-body.ts`.

**Improvements:** without Cloudflare, the source puts every client into a single shared bucket.
