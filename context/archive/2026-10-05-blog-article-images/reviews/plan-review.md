# Plan review: blog-article-images

Reviewed: plan.md and research.md against `modules/blog/src/render/render-article.ts`, `src/pages/body.ts`,
`src/options.ts`, `src/server/options.ts`, `src/quality/` (`check-article.ts`, `catalog.ts`, `settings.ts`,
`text.ts`, `rules/links.ts`), `skill/references/rules.md` and the skill sync test. Verdict: **approved**
with four findings folded into the steps (none blocking).

## Checks

| Check | Result |
| --- | --- |
| Outcome covered | `renderArticle({ images })` with allowed sources and a dimensions resolver (phase 1); an image outside the policy is not emitted (alt text, phase 1); the gate reports a refused source and a missing alt, plus unknown dimensions (phase 2). Each has a test in phase 3. |
| Security | Markup comes from markdown-it's own token renderer with escaped attributes; the source check runs on the URL that lands in `src`; protocol-relative (`//`, `/\`), `http:`, `data:`, user info and host-suffix tricks are refused and tested. `javascript:` never becomes an image token. |
| Contract for later items | BF-4 (same lane) touches `glossary.ts` and a folder-wide check; this change does not touch either. No change to the content hash, the tables or `src/content/`. |
| Gate and skill | New rules join the catalog, so the skill sync test (`tests/skill.test.ts`) requires rows in `references/rules.md`: planned in phase 2 step 3. |
| Scope | Render, quality, the option, page body, CSS, skill template, README. No publish, no version bump (BL-8). |
| Language | English only; no new user-facing copy (the fallback is the author's alt text). |

## Findings

- F1 (into phase 1 step 1): `findArticleImages` must parse with the renderer's settings (`html: false`,
  footnotes) and a permissive link validator, so the gate lists what the page would see plus the images the
  validator drops (`javascript:`); alt text through the same `renderInlineAsText` as the renderer, so the
  two never disagree on "missing alt".
- F2 (into phase 2 step 2): `dimensions` is the app's code. In the renderer a throw propagates (a bug, as for
  block plugins); in the gate it becomes an `image-dimensions` error naming the failure, as `runPlugin` does
  for rule plugins, so a publish never ends in a stack trace.
- F3 (into phase 1 step 1): the resolver receives the normalised `src` (percent-encoded, e.g. `%20`), the
  value the browser requests. The README says so and a test pins it.
- F4 (into phase 3 step 1): add a regression test that an image no longer counts as an internal link
  (`internal-links` and `internal-link-target`), since that misreading exists on master today.
