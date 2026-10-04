---
change_id: blog-content-store
title: "Blog content store and publish script"
status: backlog
roadmap_item: BL-2
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`@softure-ai/blog`: article and term tables in the module's schema, Markdown files with a strict frontmatter, `softure-blog publish` (dry run by default), slug history.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **BL-2** (roadmap `blog`, main since 2026-10-04):

> ### BL-2: Blog content store and publish script
> - **Change ID:** `blog-content-store`
> - **Status:** ready
> - **Outcome:** A new module `@softure-ai/blog` (`modules/blog/`, copied from `templates/package/`) with its own schema and forward-only migrations:
>   - `articles` (kind `article` or `term`, status `draft`/`published`/`withdrawn`, summary, sources, FAQ, term forms, cluster and pillar flag, `current_as_of`, content hash) and `slug_history`;
>   - database constraints for every invariant that can be one (a published article has a date, slugs unique, statuses closed);
>   - the article file format: Markdown with a YAML frontmatter validated by a strict zod schema (English keys, unknown key is an error), extendable by an app plugin schema for domain fields (FIRE's calculator scenario stays in FIRE);
>   - `softure-blog publish <dir>`: dry run by default, `--commit` writes; content hash skips unchanged files; a slug change records the old slug; one pillar per cluster checked over the whole directory;
>   - `getPublishedArticle`, `listArticles` and friends as read functions for the pages (BL-4).
> - **Prerequisites:** none (roadmap trigger).
> - **Unknowns:**
>   - Whether FIRE's Polish frontmatter keys get an alias map for adoption or a one-off file rename in FIRE's own roadmap.
>   - Where an app keeps its articles by default (`content/blog/`) and how the CLI finds the database (`DATABASE_URL`, like `softure migrate`).
> - **Risk:** medium. The contract every later blog item builds on.
> - **Baseline:** FIRE `src/db/blog.ts`, `src/db/blog-publish.ts`, `src/lib/blog-article-file.ts`, `scripts/blog-publikuj.ts` and migrations 0050–0053 with their tests. After: the same tests green in the package on PGlite, zero FIRE literals in `src/`.
> - **PRD refs:** FR-28, NFR-2, NFR-4.
> - **Source (FIRE_TRACKER, read only):** `src/db/blog.ts`, `src/db/blog-publish.ts`, `src/db/blog-transport.ts`, `src/lib/blog-article-file.ts`, `src/lib/blog-paths.ts`, `scripts/blog-publikuj.ts`, `drizzle/0050`–`0053`

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `modules/blog/` scaffold, `migrations/`, `src/content/`, `src/db/`, `src/cli/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
