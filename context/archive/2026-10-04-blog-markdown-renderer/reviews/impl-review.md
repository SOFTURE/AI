# Implementation review: blog-markdown-renderer

Reviewed: the diff of `modules/blog/src/render/`, `src/server/index.ts`, `src/messages/`,
`package.json`, the README and the five test files, against plan.md, plan-review.md and FIRE's
`blog-markdown.ts`, `blog-glossary.ts` and `getReadingMinutes`. Gates: `npm run typecheck`,
`npm run lint`, `npm test`, `npm run build` green. Verdict: **approved**; two gaps filed (R1, R2).

## Checks

| Check | Result |
| --- | --- |
| Outcome | `renderArticle` renders on the server only (exported from `@softure-ai/blog/server`); allowlist by `html: false` with images off and a scheme check; external links get rel, target, a marker and hidden copy; heading ids and an optional TOC; glossary first mention outside headings, links, code and footnotes; block plugins with HTML or node output; reading time. |
| Baseline | Every case of FIRE's `blog-markdown.test.ts` and `blog-glossary.test.ts` passes in English in `render-article.test.ts` and `render-glossary.test.ts`; FIRE's chart cases pass through the plugin fixture in `render-blocks.test.ts`; FIRE's reading-time rule in `reading-time.test.ts`. |
| Security | `render-xss.test.ts`: raw HTML blocks and inline tags escaped; `javascript:` in any case, entity- or percent-encoded, split by a tab, newline or leading spaces, as an autolink or a reference definition stays text; `vbscript:`, `data:`, `file:` refused; protocol-relative links marked external; title and URL attribute breakout escaped; heading text, TOC and fence info escaped. Plugin output is trusted and the README says so. |
| Plan findings | F1 protocol-relative links: done and tested. F2 decoded scheme check: done (percent-decoding added after the tab fixture showed markdown-it validates the encoded URL). F3 marker in `link_close` with a stack: done. F4 throwing plugin propagates, unregistered fence stays code: tested. |
| Contract | No change to `src/content/`, `src/db/`, the content hash or the tables. `toGlossary` reads `kind`, `slug`, `termForms` of stored rows. |
| Language | English code, tests use `\u` escapes for Polish letters; copy in `messages/{en,pl}.ts` under `render`. |

## Findings

- R1 (gap, BF-3): images are disabled, as in FIRE; articles cannot show one until there is a hosting
  policy (allowed sources, alt, dimensions). Filed as `blog-article-images`.
- R2 (gap, BF-4): a form listed by two terms links to the first term silently (`createTermMatcher`,
  FIRE's rule). A folder-wide check should refuse it. Filed as `blog-glossary-form-conflicts`.
- R3 (fixed): `no-control-regex` refused the control-character class; replaced by a character filter.
- R4 (accepted): a plugin fence inside a list or a quote renders as code, because a node segment
  cannot sit inside list HTML. Stated in README §12.
