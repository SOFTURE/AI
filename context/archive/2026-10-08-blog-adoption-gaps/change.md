---
change_id: blog-adoption-gaps
title: "blog 0.1.8: adoption gaps (optional external-link marker, quality paths from routes, metadata builders, 410 links, history precision) (issue #228)"
status: archived
roadmap_item: null
issue: 228
branch: claude/project-thread-jtxc7k
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Close every point of [issue #228](https://github.com/SOFTURE/AI/issues/228), found while an app moved its own blog
(own look, live texts) onto `@softure-ai/blog` 0.1.7:

1. the external-link marker can be turned off (icon and text, text only, none);
2. `quality.paths` defaults from the module's `routes`, the explicit field stays an override;
3. an app with its own page components can still use the module's metadata and JSON-LD wiring (builders exported
   apart from the ready-made pages);
4. the 410 page takes the app's extra links, or the app renders the whole body;
5. an imported history keeps its timestamps' precision (microseconds, what `timestamptz` holds).

A reviewer checks the blog tests (render, quality resolver, metadata builders, gone page, history import), the README
and the CHANGELOG.

## Context

Issue #228, the follow-up to #196. Work is tracked in GitHub Issues: no roadmap item; the PR closes the issue.

## Constraints

- Scope: `modules/blog` only. No other open PR touches it.
- Today's behaviour stays the default for every point (no adopting app changes without opting in), except point 5,
  which only keeps more of what the input already says.
- English-only code and docs; Polish copy only in `messages/pl.ts`.

## Process notes

- Research: skipped as a separate file. The issue names each gap with its file and line, and reading
  `render-article.ts`, `pages/body.ts`, `options.ts`, `quality/options.ts`, `quality/settings.ts`,
  `quality/link-targets.ts`, `cli/run.ts`, `cli/skill.ts`, `next/pages.tsx`, `pages/redirects.ts`, `proxy/index.ts`,
  `db/history.ts` and `db/articles.ts` answered every unknown; the findings are in plan.md's "Today" section.
- Framing: skipped. Each point is an observed adoption gap with the fix the adopter suggested; the open choices
  (option vs message override, props vs builders) are settled in the plan.
