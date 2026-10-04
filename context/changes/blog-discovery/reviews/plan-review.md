# Plan review: blog-discovery

Reviewed: plan.md and research.md against FIRE's `blog-discovery.ts`, `indexnow.ts`, the feed route and
their tests, SOFTURE `modules/seo/src/` (`sitemap.ts`, `settings.ts`, `next/`, `server/indexnow.ts`),
`modules/blog/src/` (`db/publish-run.ts`, `cli/run.ts`, `next/`, `ui/blog-article.tsx`),
`foundation/core/src/config.ts` (optional `dependsOn`), `eslint.config.mjs` and `examples/next-app/`
(config, sitemap route, `blog:fixtures`, e2e). Verdict: **approved** with four findings folded into the
steps (none blocking).

## Checks

| Check | Result |
| --- | --- |
| Outcome covered | RSS 2.0 route (phase 2.3), sitemap contributor with real `lastmod` (1.1, 2.3), IndexNow submit on `--commit` with a dry run without it (1.1, 1.2), "read next" by cluster with the pillar first (1.1, 2.2, 2.3); e2e for feed and sitemap (3.2). |
| Unknown | Answered in research (CLI and function) and recorded under Decisions (auto). |
| Baseline | FIRE's `blog-discovery.test.ts` (sitemap, RSS, related), `indexnow.test.ts` (paths) and the feed route test (200, 503) map to 1.1 and 2.3; FIRE-only cases (key file in `public/`, calculator reading) are out of scope by design: seo owns the key file. |
| Contract | No change to tables, content hash, `src/content/`, `src/db/`, `src/render/`, `src/quality/`. The publish run already reports `PublishedChange` with `statusBefore`, `previousSlug` and `kind`: the IndexNow paths need nothing more. |
| Package standard | Route handler from `./next`, server function from `./server`, optional peer like `auth` → `mailing`; copy in dictionaries; tokens only. |
| Scope | BF-7 stays out; the cache window after a CLI publish becomes BF-9. |
| Language | English code and copy keys; Polish copy only in `messages/pl.ts`. |

## Findings

- F1 (into 1.1): the ESLint rule that keeps `next/*` out of module code lists `src/server/**`,
  `src/ui/**` and `src/pages/**`. Add `src/discovery/**`, so the pure part stays framework-free by a gate.
- F2 (into 1.1): the submit must not hand a foreign URL to seo: paths only, which seo resolves on its
  `siteOrigin`. Test that a renamed published text yields both slugs and that an unchanged run yields
  `skipped` without a request.
- F3 (into 1.2): `--withdraw` runs end with `done` too; the submit must run there as well (the address
  now answers 410), and the usage text must name `--no-indexnow`.
- F4 (into 2.3): the feed's 503 log line must not carry the driver error's stack or the database URL;
  use `errorLogLabel` from core like seo's sitemap.

## Risks

- The plain-Node load of `@softure-ai/blog/next` from `softure.config.ts` (named in the plan) is the one
  real unknown; the fallback is local to the example's config.
