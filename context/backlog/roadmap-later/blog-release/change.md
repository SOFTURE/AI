---
change_id: blog-release
title: "SEO and blog release"
status: backlog
roadmap_item: BL-8
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`@softure-ai/seo` and `@softure-ai/blog` 0.1.0 published through the release pipeline; READMEs, adoption guides and docs updated.

## Context

From [`roadmap-later.md`](../../../foundation/roadmaps/roadmap-later.md), item **BL-8** (carried over on 2026-10-04
from roadmap `blog`, archived in [`2026-10-04-2-roadmap.md`](../../../foundation/archive/2026-10-04-2-roadmap.md),
to the queued roadmap `later`):

> ### BL-8: SEO and blog release
> - **Change ID:** `blog-release`
> - **Status:** blocked (carried over from blog: the owner's first npm publish at the keyboard)
> - **Outcome:** `@softure-ai/seo` and `@softure-ai/blog` 0.1.0 published through the FD-2 pipeline (the owner approves each first, staged publish and adds its trusted publisher); module READMEs with an adoption guide for FIRE_TRACKER (its blog plugins: engine chart, facts rules, calculator scenario); a finish review across BL-1…BL-7.
> - **Prerequisites:** BL-1…BL-7 (done).
> - **Unknowns:** none beyond the owner's npm steps.
> - **Risk:** low.
> - **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
> - **PRD refs:** FR-2, FR-26, G-4.

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: module READMEs, `docs/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
