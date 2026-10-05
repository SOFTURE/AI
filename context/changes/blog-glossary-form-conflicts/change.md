---
change_id: blog-glossary-form-conflicts
title: "A glossary form claimed by two terms is refused at publish and reported by check"
status: implement
roadmap_item: BF-4
branch: claude/project-thread-cqtfbb
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

Two published glossary terms that list the same form (or forms equal up to a capital first letter, which
the renderer treats as one phrase) are an editorial mistake: the renderer links the phrase to whichever
term comes first and the other definition never gets the link. After this change:

- `softure-blog publish` refuses a run that would leave a form claimed by two published terms when at
  least one of them is in the run, naming the form and both slugs; nothing is written.
- `softure-blog check` reports the conflict as an error on each checked term file that takes part in it,
  naming the form and the other slug, so CI catches it before a publish.
- The renderer's "first term wins" stays as the deterministic fallback for data already stored.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BF-4).

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-4**:

> ### BF-4: A glossary form belongs to one term
> - **Outcome:** a check over the whole content folder (a publish-run problem or a BL-6 rule) refuses a
>   form claimed by two terms, naming both slugs; the renderer's "first term wins" stays as the
>   deterministic fallback.
> - **Risk:** low. An editorial mistake that links a phrase to the wrong definition; no security impact.
> - **Source:** BL-3 `blog-markdown-renderer` impl review R2.

Coordinator brief (2026-10-05): only BF-4 (lane C: `modules/blog/src/render/`, `modules/blog/src/quality/`);
BF-3 is on master. Gaps go to the blog-followups roadmap, not fixed here.

## Constraints

- Owns `modules/blog/src/render/glossary.ts` and `modules/blog/src/quality/`; touches
  `src/db/publish-run.ts` (lane B, BF-2 runs in parallel: a small, separate function, merged against
  master), `src/cli/run.ts` (the check wiring), the writing skill's `references/rules.md` and the README.
- No change to the tables, migrations, the content hash or `src/content/`.
- English-only code, comments and commits; no new user-facing copy (messages are for developers and agents).
- `@softure-ai/blog` is not published yet: no version bump, the change rides its first publish (BL-8).

## Notes

- Framing skipped: the roadmap item names the outcome and both candidate places; the problem is not in
  doubt and nothing is bug-shaped.
- Research done (short): where the renderer's glossary comes from, when two forms collide for the
  matcher, what the publish run and `check` can see.
