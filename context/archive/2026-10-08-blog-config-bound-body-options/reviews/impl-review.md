# Implementation review: blog-config-bound-body-options

Reviewed: the branch diff against `plan.md` (D1-D4, Phase 1) and the plan review's accepted finding.

Verdict: **approve** (no open blocking findings; two findings fixed in the change, one recorded).

## Plan conformance

- D1: `/next` exports `getBodyOptions(config, terms, context?)` and `findArticlesLinkingTermFor(config, input)`
  plus the input type `ArticlesLinkingTermInput`.
- D2: the finder takes `{ articles, termSlug, terms }`.
- D3: both live in `src/next/body.ts`; `pages.tsx` lost its private copy and imports `getBodyOptions`, so the
  article and term pages build their body input through the exported function (the term page's list keeps
  calling `findArticlesLinkingTerm` with the input it already built for the body, to avoid a second glossary
  build; it is the same function `findArticlesLinkingTermFor` wraps).
- D4: README "Own page components" (example and what each returns), CHANGELOG 0.1.10, `package.json`,
  `module.json`, the inline manifest in `src/index.ts` and the lockfile at 0.1.10.

## Findings

### I1 (Suggestion, fixed): the lockfile was behind on another package
`npm install --package-lock-only` also moved `modules/seo` from 0.1.6 to 0.1.7 in `package-lock.json`: seo's
`package.json` was already 0.1.7 on master. The lockfile now matches the workspace; no code change.

### I2 (Suggestion, recorded): `getBodyOptions` is a generic name in `/next`
It is the name the issue proposed and nothing else in the package exports it; the doc comment says it is the
input of `renderPageBody` and `findArticlesLinkingTerm`. Kept.

### I3 (Warning, fixed): the inline manifest kept 0.1.9
The first full `npm test` failed two cases of `module.test.ts`: `src/index.ts` carries the manifest version
next to `module.json`. Bumped to 0.1.10; the blog suite is green.

## Evidence

- `tests/next/pages.test.tsx`: the three new cases were red on master's code (`findArticlesLinkingTermFor is not
  a function`, `getBodyOptions is not a function`), green after. They compare against the ready-made pages'
  rendered HTML, not against the new function's own logic.
- Gates: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` green on the branch.
