---
change_id: ui-tokens-theme
title: "UI tokens, theme and CSS pipeline"
status: impl_reviewed
roadmap_item: FD-5
branch: claude/fd-5-ui-tokens-theme-ohfdkh
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`--sft-*` token contract with light and dark defaults, `SoftureThemeProvider`
(object or `design.json` input), a theme switch with a no-flash boot script, a Tailwind 4
bridge file, and the build that emits `styles.css` in `@layer softure`.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FD-5** (roadmap `foundation`):

> ### FD-5: UI tokens, theme and CSS pipeline
> - **Change ID:** `ui-tokens-theme`
> - **Status:** ready
> - **Outcome:** `--sft-*` token contract with light and dark defaults, `SoftureThemeProvider`
>   (object or `design.json` input), a theme switch with a no-flash boot script, a Tailwind 4
>   bridge file, and the build that emits `styles.css` in `@layer softure`.
> - **Prerequisites:** FD-3 (messages for switch labels).
> - **Unknowns:** how to compile Tailwind-authored components to static CSS per package; the token
>   naming scheme vs. the FIRE semantic names (mapping table).
> - **Risk:** medium.
> - **Baseline:** none. After: a page renders with default tokens and with an override theme;
>   CSS size is measured (NFR-7).
> - **PRD refs:** FR-7, NFR-7.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `foundation/ui/` tokens, theme and CSS build (not the components).
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
