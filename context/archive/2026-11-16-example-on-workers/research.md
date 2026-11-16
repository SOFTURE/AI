# Research: example-on-workers (RP-10)

## Question

Can `examples/next-app` run its whole e2e suite in workerd (OpenNext + `wrangler dev`, no Cloudflare account) with
only the host switch differing from the Node build, and what does the platform layer still lack for that?

## Findings (measured in a cloud session, OpenNext Cloudflare 1.20.17, wrangler 4.163.0, Next 16.4.5)

1. **Bundling.** OpenNext bundles the Next 16 proxy (`proxy.ts`) with its own Node-middleware esbuild (conditions
   `["module"]`, `node:*` external). Two consequences:
   - any package kept external through `serverExternalPackages` turns the proxy's Turbopack module async, and the
     middleware fails with "Promise.prototype.then called on incompatible receiver"; on Cloudflare nothing may stay
     external (`@softure-ai/db`, `pg`, `@softure-ai/observability`);
   - Next keeps `pg` external by default (`transpilePackages: ["pg"]` overrides it), and the middleware esbuild resolves
     `pg-cloudflare` to its empty stand-in (the socket is exported only under `workerd`), then cannot resolve
     `cloudflare:sockets` at all. An alias of `pg-cloudflare` to its `dist/index.js` and of `cloudflare:sockets` to a
     bridge that the Worker entry fills (`registerCloudflareSockets(connect)`) fixes both.
2. **PGlite.** Turbopack resolves `@electric-sql/pglite` even when the app only uses `postgres://`; a stand-in that
   refuses with a clear message replaces it on Cloudflare.
3. **Request handle lifetime.** React keeps streaming, and querying, after the fetch handler returns its Response, and
   `after()` work runs through `ctx.waitUntil` later still. `withRequestDatabase` closed the handle on return: "Cannot
   use a pool after calling end on the pool" and `suppressions_unreadable` from mails sent in `after()`. The handle must
   close when the body ends (or is cancelled) and every `waitUntil` promise has settled.
4. **Shared health run.** workerd forbids one request awaiting I/O another request started, so ops' shared `inFlight`
   health run fails on Workers; each request runs its own checks there. Ops also opened its own pool instead of the
   request handle.
5. **Mail outbox.** The fake mail provider writes to a file; workerd has no file system. A POST to an outbox URL served
   by a small Node sink keeps the e2e assertions unchanged.
6. **Client address.** wrangler and miniflare always set `CF-Connecting-IP`, so the "request without the header is
   refused" security test cannot hold on Workers; that one assertion branches on the host.
7. **Database.** Hyperdrive's `localConnectionString` (overridden by
   `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`) points at the same Postgres as the Node e2e.

## Ownership

Generic findings (1–5) belong to packages: db (`next-config`, request scope, sockets bridge), ops (health), mailing
(`outboxUrl`), deploy (worker template). Only 6 and the Playwright config are the example's.

## Noise that is not ours

One "Uncaught TypeError: Unable to enqueue" is logged when the chat e2e stops a streaming answer: OpenNext's
`Writable` enqueues into its `ReadableStream` controller after the client cancelled, and passes the error to its
callback (`@opennextjs/cloudflare` handler, measured in the bundled worker). The test passes and the request database
still closes on cancel (db test "cancel closes it"); nothing to change on our side.
