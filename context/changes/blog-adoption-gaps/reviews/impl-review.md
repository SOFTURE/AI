# Implementation review: blog-adoption-gaps

Reviewed: the branch diff against master `a0dbf19` (`modules/blog`), against plan.md and issue #228. Mode: autonomous
(findings decided by the reviewer, accepted fixes applied in the same change).

## Plan conformance

| Point of #228 | Plan decision | Delivered |
| --- | --- | --- |
| 1. External-link marker not optional | `externalMarker` / `externalLinkMarker` | `render-article.ts`, `options.ts`, `pages/body.ts`; tests in `render-article.test.ts`, `pages/body.test.ts` |
| 2. `quality.paths` repeats `routes` | paths resolved from routes, field overrides | `quality/options.ts`, `quality/settings.ts`, `server/options.ts`, `cli/run.ts`, `cli/skill.ts`; tests in `quality/settings.test.ts`, `check-cli.test.ts` |
| 3. Pages all-or-nothing | metadata and JSON-LD builders | `next/metadata.ts`, `next/json-ld.ts`, `pages.tsx` uses them; tests in `next/pages.test.tsx` |
| 4. 410 has one way on | `gonePage.links` and `gonePage.render` | `options.ts`, `pages/redirects.ts`, `proxy/index.ts`; tests in `pages/redirects.test.ts`, `proxy.test.ts` |
| 5. History loses microseconds | timestamps kept as text, `::timestamptz` on insert | `db/history.ts`, `db/articles.ts`; test in `history.test.ts` |

No drift from the plan. Every new test was seen red on the code without the change (sabotage by stashing
`modules/blog/src` for phase 1; phase 3's test ran red before the fix).

## Findings

### 1. Warning: the metadata builder's example skipped the published check

- **Evidence:** the header comment of `next/metadata.ts` returned `buildArticleMetadata` for any text found,
  drafts included, while the builder's own doc says the caller checks the status.
- **Impact:** an app copying the comment would give a draft or withdrawn text indexable metadata.
- **Fix:** the example checks `status` and `kind` like README's. **Decision:** fixed.

### 2. Suggestion: reflowed header of `db/articles.ts`

- **Evidence:** removing the provenance note left a short first line.
- **Decision:** fixed (comment reflowed).

### 3. Suggestion: a throwing `gonePage.render` fails `createBlogRedirects`

- **Evidence:** the body is rendered once when the proxy piece is created, as the module's own page was.
- **Impact:** a bug in the app's render function shows at startup, not on the first withdrawn page, which is the
  earlier and louder place. **Decision:** kept; no code.

### 4. Checked, no finding

- Security: `externalMarker: "none"` keeps `rel="noopener noreferrer"`; 410 links refuse `javascript:`, `//host` and
  `http:` at startup (test); the builders return `serializeJsonLd` output, and a title holding `</script>` cannot close
  the tag (test).
- SQL: the history timestamp goes in as a bound parameter (`${value}::timestamptz`), never interpolated.
- Compatibility: every default reproduces 0.1.7's output (module defaults test, existing render and proxy tests
  unchanged). Breaking only for code building `ArticleHistory` by hand and reading `QualityOptions.paths` as a
  resolved pair; both are in the CHANGELOG.
- Neutral wording: the touched files' provenance notes naming an adopting app were removed, README examples use a
  neutral brand.

## Verdict

Approve. Gates: see plan.md Progress.
