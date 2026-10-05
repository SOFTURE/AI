# Implementation review: blog-canonical-host-links

Reviewed: the phase 1 commit (31947ab) against plan.md @ 2026-10-05. Verdict: done.
Findings: 0 critical, 0 warnings, 2 notes. No gaps.

## Plan conformance

| Plan item | Delivered |
| --- | --- |
| 2 renderer | `pages/body.ts`: `RenderPageBodyOptions.origins` (was `origin`); every origin's host is a site host. `next/pages.tsx` `getBodyOptions` passes `[config.appOrigin, getSiteUrls(config).origin]` |
| 3 gate | `quality/settings.ts`: `resolveQualitySettings` takes an optional `siteOrigin`, added to the own origins and deduplicated. `server/options.ts` `getQualitySettings` passes `getSiteUrls(config).origin` |
| 4 docs | blog README: the BF-11 limitation removed, the `siteHosts` and `ownOrigins` comments name seo's host; the option docs (`options.ts`, `quality/options.ts`) say the same |

## Checks

- `tests/next/pages.test.tsx` (seo suite, canonical host `example.org`, `appOrigin` `app.example.com`): an
  article's body links to both hosts render without `rel`/`target`, a link to another host keeps them.
- `tests/quality/settings.test.ts`: `resolveQualitySettings` lists `appOrigin`, the site origin and `ownOrigins`
  once each; `getQualitySettings` of a config with seo counts `https://example.org/nowhere` as an internal
  link (an `internal-link-target` finding for `/nowhere`); without seo the own origins stay `appOrigin` alone.
- The three new tests failed with the test changes alone (src reverted) and pass with the fix.
- Gates green: typecheck, lint, test (full suite), build. The architecture test still holds: `src/next/` and
  `src/pages/` reach seo's rule only through `@softure-ai/core`'s `getSiteUrls`.

## Notes

- R1 (accepted): `RenderPageBodyOptions.origin` → `origins` is a breaking change of `@softure-ai/blog/pages`; the
  package is unpublished (first release is BL-8), so no migration note.
- R2 (accepted): an app calling `renderArticle` directly (outside the blog's pages) still passes its own
  `siteHosts`, as the README shows; the pages are the only built-in caller.
