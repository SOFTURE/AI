# Plan review: blog-content-store

Reviewed: plan.md and research.md against FIRE's `src/db/blog.ts`, `src/db/blog-publish.ts`,
`src/lib/blog-article-file.ts` and their tests, `modules/waitlist/` (layout, migration style, health),
`modules/mailing/src/cli/` (bin pattern), `foundation/core/src/module.ts` and
`foundation/db/src/testing.ts`. Verdict: **approved** with four findings folded into the steps (none
blocking).

## Checks

| Check | Result |
| --- | --- |
| Outcome covered | Yes: tables, constraints, file format with a plugin schema, the publish command with dry run, hash skip, slug history and the pillar rule, and the read functions each have a step and a test file. |
| Baseline | Every FIRE test case of `blog.test.ts`, `blog-publish.test.ts` and `blog-article-file.test.ts` maps to a package test, except IndexNow (BL-5), the quality gate rules (BL-6; the hook is tested), `--stdin` and the `ssh` transport (deploy). |
| Constraints | Every invariant that fits a row is a CHECK; slug uniqueness is a unique constraint; the pillar rule is a deferrable exclusion; only "slug not in another article's history" stays in code (cross-table), under the row lock and the slug unique constraint. |
| Transactions | One outer transaction per run; `publishArticle` nests as a savepoint; the dry run rolls back by a sentinel; the deferred check fires only on a committing run. |
| Contract for later items | BL-3 reads `bodyMarkdown` and term forms; BL-4 reads `getPublishedArticle`, `findArticleBySlug`, `findSlugRedirect`, `listArticles` and passes `reservedSlugs`; BL-5 reads `changes`; BL-6 plugs into `gate`. |
| Scope | No `modules/seo/`, no example app, no FIRE change. |
| Language | English only; copy only in `src/messages/`. |

## Findings

- F1 (into phase 1 step 4): the app's `fields` schema comes from the app's own `zod` instance. Do not
  `.extend()` the core schema with it (mixing two zod copies). Split the parsed YAML object: core keys
  go to the core strict schema, the keys the `fields` shape names go to `fields.safeParse`, and any
  other key is reported as unknown by the parser itself. Validate the option by shape (an object with
  `shape` and `safeParse`), not with `instanceof`.
- F2 (into phase 2 step 2): the deferred exclusion fires on `COMMIT`, which drizzle surfaces as an
  error from `db.transaction`. Read SQLSTATE `23P01` from the error or its `cause` and report it as a
  problem naming the cluster; rethrow anything else. Test it with a pillar published in one run and a
  second pillar of the same cluster in another run.
- F3 (into phase 1 step 2): `updated_at` without `published_at` cannot happen in the store; make it a
  CHECK as the plan says, and also `slug_history.old_slug` kebab, so a hand-written row cannot break
  the 301 lookups BL-4 builds.
- F4 (into phase 3 step 1): the bin must refuse unknown options and a `--withdraw` over a folder before
  it loads the config or opens the database, so a typo never touches production.
