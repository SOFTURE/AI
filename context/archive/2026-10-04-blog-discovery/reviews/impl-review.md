# Implementation review: blog-discovery

Reviewed: the diff of `modules/blog/` (`src/discovery/`, `src/sitemap.ts`, `src/next/discovery.ts`,
`src/next/pages.tsx`, `src/ui/blog-article.tsx`, `src/cli/run.ts`, `src/pages/paths.ts`,
`src/server/`, manifest, `module.json`, `package.json`, copy, `styles.css`, README, tests),
`eslint.config.mjs` and the example app (`softure.config.ts`, `app/blog/rss.xml/route.ts`,
`app/sitemap.ts`, `package.json`, README, `e2e/blog.spec.ts`, `e2e/seo.spec.ts`), against plan.md,
plan-review.md and FIRE's `blog-discovery.ts`, `indexnow.ts` and feed route. Gates: `npm run typecheck`,
`npm run lint`, `npm test` (3171 passed), `npm run build` green; the example app's full Playwright run
117/117 (`npm run e2e` against local Postgres). Verdict: **approved**; one gap filed (R3).

## Checks

| Check | Result |
| --- | --- |
| Outcome | RSS 2.0 feed at `routes.rss` (`serveBlogRss`), linked from the listing and every article; `blogSitemap()` lists the listing, articles, glossary, terms (each dated by `updated_at ?? published_at`) and the method page without a date; `softure-blog publish --commit` submits the changed addresses through seo's IndexNow, a dry run prints them, `--no-indexnow` skips; `submitBlogChanges` serves an app's own publishing path; "read next" under each article between the app's two slots. |
| Baseline | FIRE's sitemap, feed, related and IndexNow path cases pass in English in `tests/discovery/`; the feed route's 200 and 503 cases in `tests/next/discovery.test.ts`; the example's feed and sitemap list the fixture texts (e2e). |
| Optional seo | `@softure-ai/seo` is an optional peer and `dependsOn: { seo: "^0.0.0?" }`; the submit imports it dynamically only when `seo()` is listed; an architecture test forbids a static import. Without seo the command prints `indexnow: off, …` and the tests cover both paths. |
| Plan findings | F1 `src/discovery/**` in the `next/*` import rule and in the architecture test: done. F2 paths only, rename and unchanged-run cases: done (the submit sends canonical URLs, R2). F3 the submit runs after `--withdraw` too, usage names `--no-indexnow`: done, tested. F4 the feed's 503 log uses `errorLogLabel`: done, tested. |
| Errors | A failed submit is a warning with the addresses, exit code 0 (the publish is written); a failed read in the feed is a 503 with `retry-after`; in the sitemap seo logs and skips the contributor. |
| Copy and styles | `pages.readNext` and `feed.unavailable` in `en` and `pl`; `blog-related` rules on `--sft-*` tokens only; the architecture tests (no raw colour, no inline copy, every class styled) are green. |
| Language | English code and docs; the language gate is green on the whole tree. |

## Findings

- R1 (fixed in the change): the plan put `blogSitemap()` in `@softure-ai/blog/next`. `softure.config.ts`
  imports it and also loads in plain Node (`softure migrate`, `scripts/blog.ts`), where `/next` fails on
  `next/cache` (an extensionless import a bundler resolves). The contributor now lives in the root entry
  and imports `readBlogSitemap` of `/next` when the sitemap is requested; checked with plain `node`
  and the e2e build. An architecture test keeps the root entry from importing `/next` statically.
- R2 (fixed in the change): seo's `submitToIndexNow` resolves a path on the site origin without the
  trailing-slash rule, so a path would be submitted as a non-canonical URL with
  `canonical.trailingSlash: true`. The blog passes `buildCanonicalUrl` results; tested.
- R3 (gap, BF-10): the command runs outside the app and cannot `revalidateTag`; the running app and
  IndexNow's crawlers see a change after `revalidateSeconds`, as in FIRE. Filed as
  `blog-publish-cache-refresh` in the followups roadmap.
- Not a finding: the feed's links use `appOrigin` like every blog page (BF-7 moves both to the seo rule).
