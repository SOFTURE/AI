---
change_id: blog-article-images
title: "Article bodies show images that follow the app's image policy, and the gate reports the ones that do not"
status: new
roadmap_item: BF-3
branch: claude/project-thread-v7upyb
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

An author can put an image in an article body (`![alt](src)`). The renderer emits it only when it
follows the app's image policy: a source on the site (a root-relative path) or on an allowed host over
https, a non-empty alt text, and a width and height the app knows (no layout shift); the image loads
lazily. An image outside the policy is not emitted: the reader sees its alt text. The quality gate
(`softure-blog check` and every publish) reports a refused source, a missing alt and unknown dimensions,
so a text with such an image cannot go public.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BF-3).

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-3**:

> ### BF-3: Images in article bodies
> - **Outcome:** `renderArticle({ images })` takes an image policy (allowed sources, a resolver that gives
>   width and height); an image outside it stays text; the quality gate (BL-6) reports a missing alt or a
>   refused source.
> - **Risk:** low. The renderer disables images today, so nothing unsafe ships; texts just cannot show one.
> - **Source:** BL-3 `blog-markdown-renderer` impl review R1.

Coordinator brief (2026-10-05): only BF-3 (lane C: `modules/blog/src/render/`, `modules/blog/src/quality/`);
BF-4 follows in the same lane. Gaps go to the blog-followups roadmap, not fixed here.

## Constraints

- Owns `modules/blog/src/render/` and `modules/blog/src/quality/` for this lane; touches
  `src/options.ts` (the `images` option), `src/pages/body.ts`, `src/server/options.ts`, `styles.css`,
  the writing skill's `references/rules.md` and the module README. No change to `src/content/`, `src/db/`,
  the content hash or the tables.
- FIRE_TRACKER is read only.
- English-only code, comments and commits; user-facing copy only in message dictionaries.
- `@softure-ai/blog` is not published yet: no version bump, the change rides its first publish (BL-8).

## Notes

- Framing skipped: the roadmap item names the outcome and the place (renderer option, gate rules); the
  problem is not in doubt and nothing is bug-shaped.
- Research done (short): how markdown-it parses images, what a safe source check needs, how the gate
  reaches the app's policy and how images interact with the existing link rules.
