---
change_id: ui-primitives
title: "UI primitives"
status: new
roadmap_item: FD-6
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

Button/ButtonLink/IconButton, Modal (+ ModalForm), Toast, Select (ARIA listbox), Switch/Checkbox/SegmentedControl, TextField/PasswordField/MoneyField/SelectField, Card/Stat/EmptyState, Hint, ActionForm, icons. Every component has typed `classNames` slots, `unstyled`, messages for every visible or ARIA text, and an injected `LinkComponent`. Ported from FIRE_TRACKER `src/components/*` with their tests.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FD-6** (roadmap `foundation`):

> ### FD-6: UI primitives
> - **Change ID:** `ui-primitives`
> - **Status:** ready
> - **Outcome:** Button/ButtonLink/IconButton, Modal (+ ModalForm), Toast, Select (ARIA listbox),
>   Switch/Checkbox/SegmentedControl, TextField/PasswordField/MoneyField/SelectField, Card/Stat/EmptyState,
>   Hint, ActionForm, icons. Every component has typed `classNames` slots, `unstyled`, messages for
>   every visible or ARIA text, and an injected `LinkComponent`. Ported from FIRE_TRACKER
>   `src/components/*` with their tests.
> - **Prerequisites:** FD-5.
> - **Unknowns:** which FIRE components carry domain props that must be dropped (e.g. data-tone
>   accents); keyboard behaviour coverage worth porting from FIRE integration tests.
> - **Risk:** medium (breadth).
> - **Baseline:** FIRE's component tests. After: the same behaviour tests pass in the package.
> - **PRD refs:** FR-8, NFR-3, NFR-6.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `foundation/ui/src/ui/` components and their tests.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
