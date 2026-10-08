# Plan review: mcp-access-oauth-hosts

Reviewed: plan.md against change.md, issue #234 and the code on master `6da46f0`.
Verdict: **approve after fixes** (all applied to plan.md).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Critical | `getAuthorizationServerMetadataRoute()` takes no request, so Next may render the `GET` handler at build time and bake one origin into the document: the resolver would never run for it. | Fixed: both discovery routes take the `Request` and pass it to `serveDiscoveryDocument`; README keeps `dynamic = "force-dynamic"` advice for the routes. |
| 2 | Warning | A resolver that throws inside a handler turned into an unlogged 500 in some paths (discovery serves outside the handlers' try blocks). | Fixed: a resolver error is a setup bug and propagates by name, like a missing rate limit bucket; documented. |
| 3 | Warning | The consent page and the decision must resolve the same `appOrigin`, else the page posts to one origin and the decision compares with another. | Accepted: both resolve from the same headers (`Host`), and a test drives page parameters → decision → token with the resolver on. |
| 4 | Suggestion | `X-Forwarded-Proto` with a value other than http/https (`wss`) must not produce an `wss://` issuer. | Fixed: `readRequestOrigin` uses it only when it is `http` or `https`. |
| 5 | Check | Defaults: with neither option every builder returns today's URLs; existing tests stay unchanged as the oracle. | No change. |
| 6 | Check | Security: `Host` selects only among configured `resourceOrigins`; the app origin from `Host` is opt-in through `resolveAppOrigin`, and the CSRF check still compares the browser's `Origin` with the origin of the `Host` the browser sent, which a cross-site form cannot align. | No change; README states the proxy must pass `Host` through and refuse unknown hosts. |
| 7 | Check | Version: the PR bumps 0.1.8 in `package.json`, `module.json`, manifest and the lockfile, as earlier changes did. | No change. |

No lesson ignored.
