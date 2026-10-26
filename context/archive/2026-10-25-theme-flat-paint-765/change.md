---
change_id: theme-flat-paint-765
title: "themes: a Flat Paint theme package on the theme kit (issue #765)"
status: archived
roadmap_item: null
issue: 765
branch: claude/project-thread-2rrogl
created: 2026-10-25
updated: 2026-10-25
archived_at: 2026-10-25
---

## Intent

Close [issue #765](https://github.com/SOFTURE/AI/issues/765): an adopting app stops keeping its Flat Paint design
system (tokens, the `--sft-*` bridge, page base, look deltas over `@softure-ai/ui`) in its own stylesheet and
wrappers. A second theme package, `@softure-ai/theme-flat-paint`, joins `themes/` on the kit's contract.

## Context

- Source of the look: the owner's Flat Paint design system (its `tokens.json`, brand book and component notes) and
  the adopting app's implementation, which is its reference and moves to the package in a change of its own.
- The adopting app renders with `@softure-ai/ui` components, not shadcn/ui; ui's default theme already carries this
  design system's values, so the package ships tokens, the bridge, the page base and class maps, no components.

## Constraints

- Reusable code only: no app copy, no screens, no brand mark, no domain meaning beyond the design system's own role
  names.
- The token snapshot holds values only (no prose), so it passes the language gate; the eight position colours get
  English names, and the design system takes the same names.
- No release in this change: the release follows the merge through `auto-release.yml`.

## Notes

- Framing: skipped. The owner named the outcome and the template (theme-notion).
