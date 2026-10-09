---
change_id: blog-quality-helpers
title: "blog: block-numbers rule, fact rules with softure-blog refresh, static-page read guard, readArticleDir, createBlogProxy, getFeaturedArticles (issue #318)"
status: archived
roadmap_item: null
issue: 318
branch: claude/project-thread-eeujh8
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #318](https://github.com/SOFTURE/AI/issues/318). An adopting data-driven blog keeps six generic pieces as
its own plugins and helpers on top of `@softure-ai/blog` 0.1.10:

1. a rule that the significant numbers in the paragraph before and after a data block appear in the block's data;
2. fact rules (a keyword, the first number of its sentence, the allowed value for the sentence's year, in cents or
   basis points) and a list of texts to refresh when a rule's value expires each year or quarter;
3. a guard for reading published articles on a prerendered page: empty during `next build`, empty and logged when
   the database read fails;
4. a reader of a content folder, which the CLI has internally and the app writes twice;
5. the proxy pieces combined in the order the docs require (Markdown first, then redirects);
6. featured articles, pillars first.

After the change the app drops those copies: `BlockPlugin.numbers` plus the built-in `block-numbers` rule,
`quality.facts` with `factRule(...)` and `softure-blog refresh`, `readForStaticPage` / `getStaticPublishedArticles`,
`readArticleDir`, `createBlogProxy` and `getFeaturedArticles` / `selectFeaturedArticles`.

A reviewer checks `tests/adoption-gaps-318.test.ts`, the README sections on the quality gate, mounting and the CLI,
and the CHANGELOG entry.

## Context

Issue #318, filed by an adopting app. No roadmap: work comes from GitHub issues. `@softure-ai/blog` 0.1.11 (#317) is
on master and not yet on npm, so this change folds into 0.1.11. #332 (blog) runs in parallel; whoever merges second
folds into the unreleased CHANGELOG section.

## Constraints

- Nothing changes for an app that sets none of the new options: no new rule fires without `numbers` or `facts`.
- The gate stays pure: fact rules and `numbers` take data from the app, never from the network or a database.
- English-only code and docs.

## Process notes

- Research: skipped as a separate file. The issue names the functions it builds on (`findSignificantNumbers`,
  `normalizeNumber`, `cli/run.ts` `readArticleFiles`); reading `src/quality/*`, `src/render/render-article.ts`,
  `src/proxy/index.ts`, `src/next/data.ts`, `src/pages/listing.ts` and `src/cli/*` answered every unknown; the
  findings are in plan.md's "Today" section.
- Framing: skipped. The issue lists six concrete gaps with proposals; the choices are settled in plan.md.
