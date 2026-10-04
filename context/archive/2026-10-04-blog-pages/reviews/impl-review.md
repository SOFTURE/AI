# Implementation review: blog-pages

Reviewed: the diff of `modules/blog/` (`src/pages/`, `src/ui/`, `src/next/`, `src/proxy/`,
`src/server/options.ts`, `src/options.ts`, `styles.css`, copy, README, tests), `eslint.config.mjs`,
`tests/repo/markdown-links.ts`, the example app (`app/blog/`, `content/blog/`, `proxy.ts`, config,
copy, scripts, e2e) and `.github/workflows/e2e.yml`, against plan.md, plan-review.md and FIRE's
`src/app/blog/**`, `blog-page.ts`, `blog-route.ts`, `blog-proxy.ts`. Gates: `npm run typecheck`,
`npm run lint`, `npm test`, `npm run build` green; the example app's full Playwright run 114/114.
Verdict: **approved**; two gaps filed (R1, R2).

## Checks

| Check | Result |
| --- | --- |
| Outcome | Listing grouped by cluster with the pillar first; article page with dates in the app's time zone, summary, contents, glossary links, FAQ, sources, signature and disclaimer; glossary index and term pages with the articles that explain a term; the optional method page; an OG card per article with the brand's colours; `cta` and `afterArticle` slots (the example passes a CTA and `<Waitlist placement="blog" />`). Each page is one re-export in the app. |
| Status codes | 301 from slug history and from a term at the article path (and back), keeping the query; 410 with a noindex page for a withdrawn article or term (empty body on HEAD); 404 for drafts and unknown slugs from the page. Only exact `/<index>/<slug>` and `/<glossary>/<slug>` shapes are looked up (F6); a lookup failure passes the request on. Covered in `proxy.test.ts`, `redirects.test.ts` and `e2e/blog.spec.ts`. |
| Metadata | Absolute canonical, OG and JSON-LD URLs on `appOrigin` (F1); `BlogPosting` + `BreadcrumbList` + `FAQPage`, `DefinedTerm` in a `DefinedTermSet`; `dateModified` equals the visible update day; an empty listing or glossary is noindex. |
| Baseline | FIRE's path, cluster, crumb, JSON-LD and proxy cases pass in English in `tests/pages/` and `tests/proxy.test.ts`. |
| Plan findings | F1 absolute URLs: done. F2 the `next/*` import rule covers `src/pages/**`: done, and an architecture test keeps `next` out of `ui`, `pages` and `proxy`. F3 plain `<a>`: done. F4 withdrawn term and draft fixtures: in `content/blog/`, in English. F5 `revalidate` equals `revalidateSeconds`: documented in the README and the example's files. F6 exact path shapes: done. |
| Styling and copy | `styles.css` uses only `--sft-*` tokens in the `softure` layer; the architecture test fails on a raw colour, on a `blog-*` class without a rule and on inline copy in an attribute. Every visible string is in `messages/{en,pl}.ts`. |
| Language | English code and docs; the language gate is green on the whole tree. |

## Findings

- R1 (gap, BF-5): the pages build URLs on `appOrigin`; `@softure-ai/seo`'s canonical host and
  trailing-slash rule is not applied. Matches the example app today; an app with another canonical
  host would get mismatched canonicals. Filed as `blog-seo-canonical`.
- R2 (gap, BF-6): the OG card uses `next/og`'s default font; an app needs its own
  `opengraph-image.tsx` with `renderArticleOgImage({ fonts })` for its brand font. A `brand.fonts`
  option would remove that file. Filed as `blog-og-fonts`.
- R3 (fixed): `tests/repo/markdown-links.ts` read a footnote definition (`[^fee]: The fee ...`) as a link
  reference; it now skips `[^...]:`, with a test.
- R4 (fixed): `import type { Metadata } from "next"` pulled Next's globals into the root program and
  made `NODE_ENV` read-only for `vitest.config.mts`; the pages import it from `next/types.js`.
- R5 (accepted): Next writes a same-origin redirect `Location` as a path; the e2e asserts the path.
- R6 (accepted): the 410 page styles itself with a `style` attribute; under a CSP without
  `'unsafe-inline'` for styles it renders unstyled but stays readable.
