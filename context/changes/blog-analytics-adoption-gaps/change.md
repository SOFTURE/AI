---
change_id: blog-analytics-adoption-gaps
title: "Blog and analytics cover an app that already runs its own blog and funnel"
status: plan_reviewed
roadmap_item: null
issue: "#196"
branch: claude/project-thread-fn58jg
created: 2026-10-07
updated: 2026-10-07
---

## Intent

Close [issue #196](https://github.com/SOFTURE/AI/issues/196): every gap that keeps an adopting app on its own blog
and funnel code. After this change:

**blog**
1. `renderArticle` renders leaf directives (`::chart{type="wealth" scenario="…"}` on a line of its own) through
   block plugins that declare `syntax: "directive"`, with the attributes parsed; the quality gate finds the same
   blocks (requires, unknown directive, unreadable attributes), so the gate and the renderer agree.
2. `softure-blog publish --stdin` reads the article file (`--name <slug>.md`) or a JSON bundle of files from
   standard input, so a release can pipe the content through an ssh gateway, and `--format lines` prints a stable,
   pipe-separated line contract (`blog|change|…`, `blog|summary|…`, `blog|written`, `blog|indexnow|…`).
3. `publish --history <file.json>` imports `published_at`, `updated_at` and old slugs from the app's own tables on
   the first publish of each article, so moving into `blog.*` keeps the dates and 301s and marks nothing updated.
4. An article or term page answers `Accept: text/markdown` with its Markdown (the proxy piece), a block plugin
   choosing its Markdown form.

**analytics**
5. `funnel.wire` makes the step field configurable (several accepted names, the first one sent) and lets a beacon
   or pixel carry the channel (`channelField`), so pages cached with an older wire format keep counting.
6. `channel.fromReferer` derives a channel from the path of the same-origin page a request came from, when the
   page has no tag (an article page counts under `blog`).
7. `channel.normalize: "trim-lowercase"` repairs a tag before the pattern check (server and browser alike), so
   existing links with capitals or spaces keep working.

## Context

The issue (rewritten neutrally) lists the seven points. Current state:
- The renderer turns only top-level fences of registered types into plugin blocks
  (`modules/blog/src/render/render-article.ts`, `addBlockTokens`); the gate already cuts `::name{…}` lines into
  `directive` blocks (`modules/blog/src/quality/blocks.ts`) but the block plugins only see fences.
- The CLI reads files from paths only and prints human lines (`modules/blog/src/cli/run.ts`); README §12 lists
  "no `--stdin`" as a limitation.
- `publishArticle` takes `published_at` from the file, else the row, else now (`modules/blog/src/db/articles.ts`);
  a first publish of a text whose date lives only in the app's database gets today.
- The analytics endpoint reads `step=` only (`STEP_FIELD`), the channel only from the Referer's query, and drops a
  value the pattern refuses (`modules/analytics/src/server/endpoint.ts`, `channel.ts`, `channel-rule.ts`).

## Constraints

- Every default keeps today's behaviour: no app changes behaviour on upgrade.
- No new migration: history import writes the existing columns and `blog.slug_history`.
- Touches `modules/blog/`, `modules/analytics/` and this change folder. ui/charts are changed by another thread
  (#197); this change does not touch them.
- Release of both packages through auto-release after the merge, when no other open work changes them.

## Notes

- Placement: unlinked (`roadmap_item: null`), an adoption issue; the project works from issues, not roadmaps.
- Research is folded into this file's Context (the code paths are a renderer, a CLI, one write function and one
  endpoint, all read for this change). Framing skipped: the issue names concrete gaps with proposed shapes, and the
  shapes were checked against the adopting app's code (its directive parser, publish script, tables, beacon).
