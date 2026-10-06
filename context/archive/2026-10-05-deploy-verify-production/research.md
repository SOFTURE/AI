# Research: deploy-verify-production

Date: 2026-10-05. Sources: the roadmap item, [`docs/06-fire-extraction-2.md`](../../../docs/06-fire-extraction-2.md),
`tools/deploy/` (DP-1), `tools/marketing-kit/` (the zod → JSON Schema pattern). FIRE_TRACKER's
`scripts/verify-production.sh` could not be read: cloning FIRE_TRACKER was refused in this cloud session (the same
limit DP-1 hit, recorded as DF-1).

## Questions

1. **Which checks are generic (the roadmap unknown: TLS, headers, robots)?**
   - Status, body markers, redirects and headers are generic: every app has routes, and the route list is data.
   - **TLS:** `fetch` over `https://` already refuses an invalid, expired or mismatched certificate, so a broken
     certificate fails every route with the TLS error as its detail. A warning window before expiry (FIRE may check
     days left) needs the peer certificate from `node:tls`; it is not part of this item and becomes a gap.
   - **robots.txt and sitemap:** a route like any other (`/robots.txt` with a marker such as `Sitemap:`); no special
     check is needed.
   - **Security headers** (HSTS, `x-content-type-options`, no `x-powered-by`): a `headers` map applied to every
     route, with `null` for "must be absent", covers them without app-specific code.
2. **How are redirects observed?** Node's `fetch` with `redirect: "manual"` returns the 3xx response itself with
   its `location` header. The expected target is resolved against the base URL and compared with the `location`
   resolved against the request URL, so `/new` and `https://host/new` match.
3. **Where does `deploy.json` live and what else will it hold?** At the app root, read with `--config`. Only the
   `verify` section exists now; DP-3 (row-count tables) and DP-5 (the starter file) may add sections, so the root
   is a strict object whose keys grow by item. Published as `schema/deploy.schema.json` with an unpkg `$id`, like
   marketing-kit.
4. **The CLI is synchronous (DP-1).** `verify` makes network requests, so `runCli` becomes async
   (`Promise<number>`) and commands may return a promise. DP-3's backup and schema guard need the same; whichever
   lands second merges the change.
5. **Speed with 100+ routes.** Checks run with a small concurrency limit (default 4, `--concurrency`), output in
   the order of `deploy.json`, and a per-request timeout (default 10 s, `verify.timeoutMs` or `--timeout`).

## Answer to the unknown

Generic: status, markers (present and absent), redirects, headers (present, value, absent), robots and sitemap as
routes, TLS validity through `fetch`. Not in this item: certificate expiry window, and parity with FIRE's script,
both recorded as `deploy-followups` gaps.
