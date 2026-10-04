---
change_id: waitlist-welcome-html
title: "HTML welcome mail for the waitlist"
status: backlog
roadmap_item: FU-4
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

An option for the app's HTML template of the waitlist welcome mail, next to the text version.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-4** (roadmap `followups`, main since 2026-10-03):

> ### FU-4: HTML welcome mail for the waitlist
> - **Change ID:** `waitlist-welcome-html`
> - **Status:** proposed
> - **Outcome:** An option for the app's HTML template of the waitlist welcome mail, next to the text version.
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** Template shape (function of locale and links vs. a component).
> - **Risk:** LOW.
> - **Baseline:** engagement EN-5 `waitlist`: the welcome mail is text only (README §12). After: the gap is closed and covered by unit and e2e tests.
> - **PRD refs:** FR-18.
> - **Source:** `modules/waitlist/README.md` §12

Reference material: [`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard).

## Constraints

- Exclusively owns: `modules/waitlist/` welcome mail.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
