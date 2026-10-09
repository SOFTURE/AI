---
change_id: blog-quality-helpers
status: archived
---

# Plan: block-numbers, fact rules and refresh, static read guard, readArticleDir, createBlogProxy, featured articles (issue #318)

Input: change.md (research and framing skipped, reasons there). Complexity: medium (one package, six points).

## Today (master `e2f1be8`)

- `BlockPlugin` (`src/render/render-article.ts`) has `type`, `syntax`, `requires`, `render`, `markdown`.
  `findArticleBlocks` returns `FoundBlock` (`type`, `syntax`, `info`, `attributes`, `line`, `requires`) without the
  block's content or last line. `checkArticle` runs `checkBlockRequires` and `checkDirectives` over them.
- `findSignificantNumbers`, `parseNumber`, `normalizeNumber`, `toProse`, `splitSentences` live in
  `src/quality/text.ts`; the ruleset carries the `NumberNotation`.
- `stale` (`rules/structure.ts`) warns when `current_as_of` is older than `limits.staleAfterDays`; nothing knows when
  a value a text quotes changes.
- `cli/run.ts` has a private `readArticleFiles(paths)` (a file, or every `*.md` of a folder except `README.md`,
  sorted); `COMMANDS_WITHOUT_DATABASE` in `cli/command.ts` lists `check` and `skill-install`.
- `src/proxy/index.ts` exports `createBlogRedirects` and `createBlogMarkdown`; the README tells the app to chain
  them Markdown first.
- `src/next/data.ts` `getPublishedArticles(config)` reads through `unstable_cache`; it throws when the database is
  down and needs a database during `next build`.
- `src/pages/listing.ts` `splitClusterLead` takes the pillar of one cluster; nothing picks featured articles.

## Decisions

1. **`BlockPlugin.numbers(block)`** returns the block's numbers (`number`, or a string written in the ruleset's
   notation). `FoundBlock` gains `content` and `endLine`. The built-in rule `block-numbers` (error, in the catalog
   only when a block plugin has `numbers`) takes the block right before the block and the block right after its last
   line; when that block is a paragraph, every significant number of its prose (`findSignificantNumbers`) must equal
   one of the block's numbers by value. A throwing `numbers` is a `block-numbers` error naming the plugin, not a crash.
2. **`quality.facts`**: rules built with `factRule({ id, description, patterns, allowedValues(year), unit, expires,
   severity })`. In every sentence of the prose that matches a pattern, the first number (years and legal references
   skipped) is the value; the year is the first year of the sentence, else the year of `current_as_of`. `unit`
   `"cents"` and `"bps"` multiply the value by 100 before the comparison; `"value"` (default) compares as written.
   `allowedValues` returning nothing for a year leaves the sentence unchecked. Severity default `error`. The rules
   join the catalog under a new group `facts`, so the writing skill lists them as app rules.
3. **Refresh.** `expires: "yearly" | "quarterly" | "never"` (default `never`). `findTextsToRefresh(files, settings,
   today)` lists published texts with reasons: `stale` (the `stale` rule's limit) and `fact:<id>` when the text
   quotes a rule whose value changed after its `current_as_of` (the start of today's year or quarter is later).
   `softure-blog refresh [<path>...] [--today]` prints them without a database and exits 0; a read failure exits 1.
4. **Static-page read guard.** `readForStaticPage(read, { onError, phase })` (`/server`): `[]` when the phase is
   `phase-production-build` (`process.env.NEXT_PHASE` by default), `[]` plus `onError` (default `console.error`) when
   the read throws. `/next` adds `getStaticPublishedArticles(config, options)` over `getPublishedArticles`.
5. **`readArticleDir(dir)`** (`/server` and `/cli`): `{ ok: true, files }` with `{ name, text, path }` of every `*.md`
   except `README.md`, sorted, or `{ ok: false, error }`. The CLI's reader uses it for folders.
6. **`createBlogProxy(config, options)`** (`/proxy`): `createBlogMarkdown` first, then `createBlogRedirects`, sharing
   `getContext`.
7. **Featured articles.** `selectFeaturedArticles(articles, { limit })` (`/server`, pure): pillars first, then the
   rest, each in the given order (newest first from the store), at most `limit`. `/next` `getFeaturedArticles(config,
   { limit })` over `getPublishedArticles`. A `limit` that is not a whole number from 0 up is a `RangeError`.
8. **Version.** Fold into the unreleased 0.1.11 (CHANGELOG section, README); no version bump.

## Phases

1. Tests first: `tests/adoption-gaps-318.test.ts` covering every point; they fail on master.
2. Implement decisions 1 to 7; skill rules table row for `block-numbers`; README and CHANGELOG.
3. Gates: typecheck, lint, blog tests, build, full test run.

## Progress

- [x] Phase 1: tests first
- [x] Phase 2: implementation, docs
- [x] Phase 3: gates
