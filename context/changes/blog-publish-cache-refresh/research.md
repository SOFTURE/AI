# Research: blog-publish-cache-refresh

Sources: `node_modules/next/dist/server/web/spec-extension/revalidate.{d.ts,js}` and
`node_modules/next/dist/server/lib/incremental-cache/tags-manifest.external.js` (Next 16.3.8, the version the
example installs), `modules/blog/src/next/data.ts`, `modules/blog/src/cli/run.ts`,
`modules/blog/src/discovery/submit.ts`, `modules/mcp-access/src/server/endpoint.ts` (a rate-limited,
token-guarded public route), `modules/billing/src/next/route.ts` (a route whose secret comes from the
environment), `foundation/core/src/version-range.ts` (optional dependencies), the example app's
`playwright.config.ts` and `e2e/*.serial.spec.ts`.

## Summary

In Next 16, `revalidateTag(tag)` with one argument is deprecated and logs a warning; the second argument is a
cache-life profile. `"max"` marks the tag stale (stale-while-revalidate: the next request still gets the old
page and refreshes it in the background), while `{ expire: 0 }` expires it at once (the next request waits
for fresh data). Only the second closes the window the item is about. `updateTag` works only in server
actions and throws in a route handler. The repository rate-limits public routes through
`@softure-ai/security` (`identifyClient` + `consumeRateLimit` on a bucket the app spreads into
`security({ buckets })`, counted before the credential is checked, failing closed with 503).

## Findings

1. **Which call.** `revalidateTag(BLOG_CACHE_TAG, { expire: 0 })`: `tags-manifest` treats an `expired`
   timestamp at or before now as "immediately expired" (`areTagsExpired`), so the cached reads and the pages
   built on them are recomputed on the next request. With `"max"` a crawler arriving right after the ping
   would get the stale page once. The call must run inside a request scope (a route handler works).
2. **One instance, one cache.** The default cache handler keeps tags in process memory
   (`tagsManifest = new Map()`). An app on several instances without a shared cache handler refreshes only
   the instance that answered the request. A limitation for the README, not something the blog can fix.
3. **Rate limit.** mcp-access counts every request per client address before verifying the token, refuses
   with 429 and `retry-after`, answers 503 when counting fails, and throws a named setup error when its
   bucket is missing from `security({ buckets })`. The blog lists seo as an optional dependency
   (`dependsOn: { seo: "^0.0.0?" }`) and reaches it through a dynamic import; security can be listed the
   same way, so an app that does not mount the refresh route needs no security module.
4. **The secret.** billing reads `STRIPE_WEBHOOK_SECRET` from `process.env` on every request and answers 500
   with a log line naming the variable when it is missing. The CLI already reads the environment for
   mailing's secrets (`options.env ?? process.env`). One variable, read by both sides, keeps the setup to
   one line in the app's environment. A Bearer header compared through SHA-256 digests and
   `timingSafeEqual` does not leak the secret's length or prefix through timing.
5. **Where the command sends it.** The config has `appOrigin` and the blog's routes; the route's address is
   `appOrigin + routes.refresh`. In a container the command may run where the public origin is not the
   right way in (a private network name), so an override is useful: `--app-url <origin>`.
6. **e2e.** The example's e2e runs `next start` with env from `playwright.config.ts`; specs that change
   shared state are `*.serial.spec.ts` and run after the parallel project. A serial spec can publish a
   changed body of one fixture text with the command, see it on the page at once, and publish the original
   back.

## Gap found

None.
