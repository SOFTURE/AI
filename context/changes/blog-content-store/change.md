---
change_id: blog-content-store
title: "Blog articles live in Markdown files and reach the database through a publish command"
status: implementing
roadmap_item: BL-2
branch: claude/project-thread-rfkrmt
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

An app that enables `@softure-ai/blog` keeps its articles and glossary terms as Markdown files with a
strict, English YAML frontmatter, and `softure-blog publish <dir>` brings the module's own tables to
the state of those files: a dry run by default, everything or nothing with `--commit`, unchanged files
skipped by their content hash, an old slug kept in a slug history, one pillar per cluster. The pages
(BL-4) and the quality gate (BL-6) build on read functions and a publish hook this change provides.
The same cases FIRE_TRACKER tests for its blog store pass in the package on PGlite.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BL-2).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **BL-2** (roadmap `blog`, main since 2026-10-04):

> ### BL-2: Blog content store and publish script
> - **Change ID:** `blog-content-store`
> - **Outcome:** A new module `@softure-ai/blog` (`modules/blog/`, copied from `templates/package/`) with its own schema and forward-only migrations:
>   - `articles` (kind `article` or `term`, status `draft`/`published`/`withdrawn`, summary, sources, FAQ, term forms, cluster and pillar flag, `current_as_of`, content hash) and `slug_history`;
>   - database constraints for every invariant that can be one (a published article has a date, slugs unique, statuses closed);
>   - the article file format: Markdown with a YAML frontmatter validated by a strict zod schema (English keys, unknown key is an error), extendable by an app plugin schema for domain fields (FIRE's calculator scenario stays in FIRE);
>   - `softure-blog publish <dir>`: dry run by default, `--commit` writes; content hash skips unchanged files; a slug change records the old slug; one pillar per cluster checked over the whole directory;
>   - `getPublishedArticle`, `listArticles` and friends as read functions for the pages (BL-4).
> - **Unknowns:**
>   - Whether FIRE's Polish frontmatter keys get an alias map for adoption or a one-off file rename in FIRE's own roadmap.
>   - Where an app keeps its articles by default (`content/blog/`) and how the CLI finds the database (`DATABASE_URL`, like `softure migrate`).
> - **Risk:** medium. The contract every later blog item builds on.
> - **Baseline:** FIRE `src/db/blog.ts`, `src/db/blog-publish.ts`, `src/lib/blog-article-file.ts`, `scripts/blog-publikuj.ts` and migrations 0050–0053 with their tests. After: the same tests green in the package on PGlite, zero FIRE literals in `src/`.
> - **Source (FIRE_TRACKER, read only):** `src/db/blog.ts`, `src/db/blog-publish.ts`, `src/db/blog-transport.ts`, `src/lib/blog-article-file.ts`, `src/lib/blog-paths.ts`, `scripts/blog-publikuj.ts`, `drizzle/0050`–`0053`

Coordinator brief (2026-10-04): only BL-2; BL-1 (`@softure-ai/seo`) runs in parallel in another thread
and its files are not touched here; the domain parts (`blog-chart`, `rules-facts`) stay in FIRE.

Known state: no `modules/blog/` yet. `@softure-ai/mailing` ships the closest pattern, a bin
(`softure-mail`) that loads the app's `softure.config` and opens `config.database.url`.

## Constraints

- Exclusively owns: `modules/blog/` scaffold, `migrations/`, `src/content/`, `src/db/`, `src/cli/`.
  Must not touch `modules/seo/` (BL-1) nor the example app (BL-4 mounts the blog there).
- BL-6 owns `src/quality/`: this change leaves only a publish gate hook (a no-op by default).
- FIRE_TRACKER is read only: code is copied, never changed there.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` dictionaries.
- No release, tag or publish by the agent; the owner tags releases (BL-8).
- Gaps found go to `roadmap-blog-followups` as `BF-` items, not fixed here.

## Notes

- Framing skipped: the outcome, the baseline and the source files are named by the roadmap item; the
  work is a port with two open unknowns, which research answers. Nothing is bug-shaped or in doubt.
- Research done: it answers the two unknowns and checks what FIRE's behaviour needs from the
  SOFTURE contracts (module schema, migrator, config loading).
- FIRE's `src/db/blog-transport.ts` does not exist; its test (`blog-transport.test.ts`) covers the
  `ssh` shell transport of FIRE's deploy, which belongs to the deploy roadmap, not to this package.
