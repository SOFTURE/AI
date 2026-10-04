# Research: blog-markdown-renderer

Sources read: FIRE_TRACKER (read only, commit `15ec77e`) `src/lib/blog-markdown.ts`,
`src/lib/blog-glossary.ts`, `src/lib/blog-chart-html.ts`, `src/lib/blog-page.ts`
(`getReadingMinutes`) and their tests; the callers `src/components/blog-article.tsx`,
`src/components/blog-glossary.tsx`; SOFTURE `modules/blog/src/{contract,options}.ts`,
`src/db/articles.ts` (`listArticles`), `src/messages/`, `modules/auth/src/messages/en.ts`
(placeholder style), `docs/06-fire-extraction-2.md`.

## What FIRE does

| Part | FIRE | Behaviour |
| --- | --- | --- |
| Parser | `markdown-it` 15 + `markdown-it-footnote` 4 | `html: false` (raw HTML escaped), `linkify: true`, images disabled, `validateLink` allows `http(s)`, `mailto`, relative and `#` only. |
| Links | `isExternal` | `http(s)` to a host other than `planmajatku.pl` (or a subdomain) gets `rel="noopener noreferrer" target="_blank"`. No visible marker. |
| Headings | core rule `heading_anchors` | id from the text (Polish letters folded, the l with stroke by hand), unique per text (`-2`, `-3`), fallback `sekcja`; `headings[]` returned for a TOC built by the page. |
| Footnotes | renderer rules | numbered `<sup>` refs, a "Przypisy" section with back links, Polish ids; the section heading stays out of `headings`. |
| Glossary | `createTermMatcher` + core rule `glossary_links` | longest form first, Unicode word bounds, exact case or capitalised first letter, first mention only, skips headings, links, code and footnotes, no self link, manual links to `/blog/slownik/<slug>` count as linked; returns `linkedTerms`. |
| Chart | block rule `blog_chart` | a one-line `::wykres{…}` directive → a figure HTML string computed by FIRE's engine for `currentAsOf`; error frame without the date. |
| Reading time | `getReadingMinutes` (in `blog-page.ts`) | words of prose (footnote definitions, URLs and Markdown syntax removed) / 200, rounded up, at least 1. |

FIRE-specific parts that become options: the own host (`siteHosts`), the glossary URL
(`termHref`), the Polish copy (message dictionaries), the chart directive (a block plugin in FIRE).

## Unknowns answered

**U1. Which parser.** `markdown-it` (FIRE's choice). Its `html: false` gives the allowlist by
construction: the output can only contain tags its own rules emit, so the allowlist is the set of
enabled rules (images disabled) instead of a sanitiser pass. Every FIRE test already pins its output.
`micromark`/`remark` would need `rehype-sanitize` and a hast pipeline (more packages, a sanitiser
config to keep in sync), `marked` has no "no raw HTML" switch. markdown-it has two small
dependencies-free-ish deps (`entities`, `linkify-it`, `mdurl`, `punycode.js`, `uc.micro`) and is
imported only from `@softure-ai/blog/server`, so it never reaches a client bundle.

**U2. How a block plugin declares its frontmatter needs.** A plugin is
`{ type, requires?: readonly string[], render(block) }`. `requires` names the frontmatter keys the
block reads (`current_as_of` or keys of the app's `fields`). The renderer passes those values to
`render` through `block.article`, and exports `findArticleBlocks(markdown, plugins)` which lists the
blocks a text uses with their line numbers, so BL-6 can report "line 12: block `chart` needs
`scenario`" without rendering. `requires` is data, not a validator: the quality gate owns the rule.

**U3 (found). Server component output.** The page renders the body as HTML; a plugin that wants a
React server component cannot be a string. The result therefore carries `segments`: HTML strings and
`node` segments (whatever the plugin returned, e.g. a React element), in document order; `html` is
the joined string when every segment is HTML, else `null`. The package keeps no React dependency.

**U4 (found). Fence syntax.** FIRE's `::wykres{}` is a custom one-line directive. A fenced block
(```` ```chart ````) needs no extra block rule, is valid CommonMark (an unknown type falls back to a
code block on any renderer, e.g. GitHub previews) and carries a multi-line body. The info string after
the type is passed to the plugin as `info`.

## Risks

- Stored XSS: covered by fixtures (script, event handlers, `javascript:`/`vbscript:`/`data:` in any
  case or entity-encoded, autolinks, protocol-relative links, attribute breakout through titles,
  fence info strings, heading ids). Plugin HTML is trusted (the app's code); the README says so.
- A glossary form with regex characters: escaped (FIRE test kept).
