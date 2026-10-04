# Plan review: blog-pages

Reviewed: plan.md and research.md against FIRE's `src/app/blog/**`, `blog-page.ts`, `blog-route.ts`,
`blog-proxy.ts`, `blog-data.ts` and the blog components, SOFTURE `modules/blog/src/`, the ID-1 and ID-3
patterns (`modules/waitlist/src/next/`, `modules/billing/src/next/pages.tsx`,
`modules/auth/src/proxy`), `eslint.config.mjs`, `foundation/ui` (compiled classes) and
`examples/next-app/` (layout, proxy, e2e harness, CI, container check). Verdict: **approved** with six
findings folded into the steps (none blocking).

## Checks

| Check | Result |
| --- | --- |
| Outcome covered | Listing with cards, article, glossary index and term (ISR / dynamic + cache), JSON-LD (`BlogPosting` as the `Article` type, `FAQPage`, `DefinedTerm`, `DefinedTermSet`), summary box, dates, sources, optional disclaimer, CTA and under-article slots, 301/410, OG image with the brand from config, optional method page, `pl`/`en` copy, token styling: each has a phase step and a test. |
| Unknowns | U1 (slot) and U2 (`ImageResponse`) answered in research with reasons; recorded under Decisions (auto). |
| Baseline | FIRE's `blog-page.test.ts`, `blog-route.test.ts` and `blog-pages.test.tsx` cases map to phase 1 and phase 2 tests; FIRE-only cases (calculator href, topic art, Polish cluster names) are out of scope by design. |
| Contract | No change to the tables, the content hash, `src/content/`, `src/db/`, `src/render/`; the CLI only gains reserved slugs derived from routes. BL-6 adds `quality` to the same options schema: a merge, not a conflict of meaning. |
| Package standard | Pages from `./next`, proxy piece from `./proxy` (async, documented), React and Next as peers, copy in dictionaries, tokens only. |
| Scope | BL-5 parts (read next, RSS, sitemap, IndexNow) stay out; slots leave room for "read next". |
| Language | English code and fixtures; copy only in `messages/`. |

## Findings

- F1 (into phase 1 step 2 and phase 2 step 3): the example layout has no `metadataBase`, so relative
  canonical and OG URLs would resolve against a guessed host. Build canonical, OG `url` and JSON-LD
  URLs on `config.appOrigin` in the package, absolute.
- F2 (into phase 1): the ESLint rule that keeps `next/*` out of module code covers `src/server/**` and
  `src/ui/**` only. Extend it to `src/pages/**`, so the pure page logic stays framework-free by a gate,
  not by habit.
- F3 (into phase 2 step 2): the same rule says UI gets links through an injected component, not
  `next/link`. Components render plain `<a>` (server-rendered pages, nothing to prefetch); document it.
- F4 (into phase 3 step 1): e2e needs a withdrawn **term** fixture for the term 410, and a draft
  article for the 404; fixtures stay English (the language gate scans tracked files).
- F5 (into phase 3 step 3): `revalidate` in the app's page file and `revalidateSeconds` of the cache
  are two numbers; the README says to keep them equal and the example uses 300 for both.
- F6 (into phase 2 step 4): the proxy must not query for `/<index>/<slug>/opengraph-image` or any
  deeper path; test that the path parser accepts only the exact one-segment shapes.
