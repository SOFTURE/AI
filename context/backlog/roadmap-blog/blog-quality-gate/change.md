---
change_id: blog-quality-gate
title: "Text quality gate"
status: backlog
roadmap_item: BL-6
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`softure-blog check`: structure, links, style and YMYL rules with language rulesets and rule plugins; publish refuses errors.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **BL-6** (roadmap `blog`, main since 2026-10-04):

> ### BL-6: Text quality gate
> - **Change ID:** `blog-quality-gate`
> - **Status:** ready
> - **Outcome:** A quality gate in `@softure-ai/blog` that runs before every publish and in CI:
>   - structure rules (answer first, heading order, length, summary present);
>   - link rules (internal targets exist, glossary terms resolve; external links checked only with `--external`);
>   - style rules from a ruleset chosen by the app: language (`pl` ruleset ported from FIRE, an `en` ruleset), AI-writing patterns, brand voice phrases from config;
>   - YMYL rules (a number needs a source, `current_as_of` required), switchable per app;
>   - a rule plugin API: FIRE's domain rules (`rules-facts`, `rules-chart`) stay in FIRE as plugins;
>   - findings with severity and file position; `softure-blog check` exits non-zero on errors, and `publish` refuses them;
>   - a reusable weekly workflow that runs the gate with `--external`.
> - **Prerequisites:** BL-2.
> - **Unknowns:**
>   - How much of FIRE's Polish style list is generic Polish and how much is FIRE's voice (the latter goes to config).
>   - Whether rule messages are English only (developer output) or come from dictionaries (shown to editors).
> - **Risk:** medium. Texts go to production without a human read; a weak gate ships bad copy.
> - **Baseline:** FIRE `src/lib/blog/quality/**` (fixtures and tests), `scripts/blog-check.mts`, `.github/workflows/blog-links.yml`. After: the same fixtures give the same findings through the `pl` ruleset plus FIRE's plugins in a test.
> - **PRD refs:** FR-30.
> - **Source (FIRE_TRACKER, read only):** `src/lib/blog/quality/**`, `scripts/blog-check.mts`, `.github/workflows/blog-links.yml`

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `modules/blog/src/quality/`, the reusable links workflow.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
