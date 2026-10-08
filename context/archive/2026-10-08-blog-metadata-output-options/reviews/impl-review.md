# Implementation review: blog-metadata-output-options

Reviewed: commit `a6a7c30` against plan.md, change.md and issue #240. Mode: autonomous (findings decided by the
reviewer).

## Plan conformance

| Plan item | Where | State |
| --- | --- | --- |
| `jsonLd.ids` (article, term, glossary) | `src/options.ts`, `src/pages/json-ld.ts`, `src/next/json-ld.ts` | done; `JsonLdContext.ids` optional |
| `anchors.cluster` | `src/options.ts`, `src/pages/listing.ts`, `src/ui/blog-listing.tsx`, `src/next/context.ts`, `src/next/pages.tsx`, `src/next/json-ld.ts` | done; `BlogPageContext.clusterAnchorPrefix` optional |
| `locales` (`bcp47`, `openGraph`) and `getBlogLocaleTags` | `src/options.ts`, `src/server/options.ts`, `src/next/metadata.ts`, `src/next/discovery.ts`, `src/next/json-ld.ts` | done |
| `glossary.termTitleWithBrand` | `src/messages/{en,pl}.ts`, `src/next/metadata.ts` | done |
| Point 5 documented | README, "What the builders write" | done |
| README, CHANGELOG, 0.1.9 | `README.md`, `CHANGELOG.md`, `package.json`, `module.json`, `src/index.ts` | done |

## Findings

### 1. Checked: an adopting site's whole output is reachable

The issue's example values (`#artykul`, `#slownik`, `#termin`; `klaster-<id>`; `pl-PL` and `pl_PL`; one title
pattern for articles and another for terms) are each one option or one message override. The test "builders with an
adopting site's output options" sets the same kind of values and asserts the JSON-LD, the listing's section ids, the
article's crumb link, `og:locale` and both titles. No finding.

### 2. Checked: defaults keep today's output except `og:locale`

The existing page and JSON-LD tests pass unchanged apart from `openGraph.locale` (`en` → `en_US`), the one intended
change, listed first in the CHANGELOG. No finding.

### 3. Suggestion: the OG card's label still uses `pages.titleWithBrand`

- **Evidence:** `src/next/og-image.tsx` labels the card with the blog title and `titleWithBrand`; there is no term
  OG card, so the term message has no second reader.
- **Decision:** no change; the card is the article's only.

### 4. Checked: validation

Fragments refuse `#`, spaces and a leading digit; Open Graph locales refuse `pl` and `pl-PL`; BCP-47 refuses
`pl_PL` (tests in `tests/module.test.ts`). The values reach HTML attributes and URLs only after that validation.

## Verdict

Approve. No open findings.
