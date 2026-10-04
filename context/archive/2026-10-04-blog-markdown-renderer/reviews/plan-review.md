# Plan review: blog-markdown-renderer

Reviewed: plan.md and research.md against FIRE's `blog-markdown.ts`, `blog-glossary.ts`,
`blog-chart-html.ts`, `getReadingMinutes` and their tests, and SOFTURE `modules/blog/src/`
(contract, options, messages, server exports). Verdict: **approved** with four findings folded into
the steps (none blocking).

## Checks

| Check | Result |
| --- | --- |
| Outcome covered | Allowlist (`html: false`, images off, link schemes), external rel and marker, heading ids, optional TOC, glossary first mention outside headings and links, block plugins with HTML or node output, reading time: each has a step and a test file. |
| Baseline | Every case of FIRE's `blog-markdown.test.ts` and `blog-glossary.test.ts` maps to a package test, and FIRE's reading-time case. FIRE's chart cases map to the plugin fixture (fence instead of directive). |
| Security | The output tag set comes from markdown-it rules only; links are validated before rendering; attributes go through markdown-it's escaping; plugin HTML is the app's trusted code and documented as such. |
| Contract for later items | BL-4 gets `segments`, `headings`, `toc`, `linkedTerms`, `readingMinutes`; BL-6 gets `findArticleBlocks` and `requires`. No change to the content hash or the tables. |
| Scope | Only `src/render/`, the server exports, messages, package.json, README. |
| Language | English only; copy in `src/messages/`. |

## Findings

- F1 (into phase 1 step 3): a protocol-relative link (`//evil.example/x`) passes FIRE's
  `ALLOWED_LINK` as relative but leaves the site. Treat `//host` as an absolute URL for the external
  check, with a test.
- F2 (into phase 1 step 3): `validateLink` must see the URL after markdown-it's entity decoding and
  normalisation; check the scheme on the trimmed, lower-cased value and keep FIRE's entity test plus
  `vbscript:` and a tab inside `java\tscript:`.
- F3 (into phase 1 step 3): the external marker and the hidden text must not break the glossary rule
  or `linkedTerms`; add them in the `link_close` renderer rule, keyed by a flag set in `link_open`
  (a stack, for safety, though Markdown links do not nest).
- F4 (into phase 2 step 1): a plugin that throws is a bug in the app; let it propagate (no swallowed
  error), and test that an unregistered fence type renders as `<pre><code class="language-…">`.
