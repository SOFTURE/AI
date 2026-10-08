# Plan review: analytics-pixel-pages

Reviewed: plan.md against change.md, issue #235 and the code (`modules/analytics/src/options.ts`,
`src/server/endpoint.ts`, `src/next/funnel.tsx`, `module.json`). Verdict: **ready after the fixes below** (applied).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | Warning | `module.json` carries the version too (`"version": "0.1.8"`); the plan bumped only `package.json`. The repository's package-shape test compares them. | Accepted: 1.3 bumps both. |
| F2 | Warning | A page on another first-party origin (`origins`) with the same pathname matches a pathname list: `/` on the apex and `/` on `appOrigin` are both "the landing page". | Accepted as intended (the issue's pages are pathnames); the README says a list compares the pathname only and a predicate gets the full URL to tell origins apart. |
| F3 | Suggestion | A `basePath` or `trailingSlash` app sends pathnames the list must spell the same way. | Accepted: the README says the list is compared with the page's `pathname` exactly as the browser sends it. |
| F4 | Suggestion | The predicate must not mutate the `Referer` URL that `channelFromReferer` reads afterwards. | Accepted: it gets a copy (D1 already says so); a test is not needed beyond the code path. |
| F5 | Check | `FunnelStep` reaches the browser? | No: `<FunnelPixel>` is a server component and reads only the id and `via`; `getChannelRule` carries no steps. A function in a step is safe. |
| F6 | Check | Backward compatibility | Holds: `pages` is optional; the existing endpoint and wire tests stay unchanged and must stay green. |

No missing phase: one phase covers schema, endpoint, docs and version.
