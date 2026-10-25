---
change_id: theme-notion-stats-722
title: "theme-notion: StatsFold, StatCards and StatPills (issue #722)"
status: in_progress
roadmap_item: null
issue: 722
branch: claude/project-thread-s8rvlb
created: 2026-10-25
updated: 2026-10-25
---

## Intent

Close [issue #722](https://github.com/SOFTURE/AI/issues/722): export three compositions an adopting app keeps as its
own code for a screen's summary figures: `StatsFold` (figures folded under a heading, native `<details>`, closed by
default), `StatCards` (a wrapping row of figure cards with an optional hint and aside tag) and `StatPills` (small
"label **value**" tags in one row). The look must equal the issue's reference implementation.

## Context

Labels: `enhancement`, `pkg: theme-notion`, `adoption`. Depends on #720 (`Tone`, `TONE_COLORS`, `TONE_TEXT`), carried
by another thread that merges first. No release in this change: the coordinator releases theme-notion.

## Constraints

- Server components: no client state; the fold is native `<details>`.
- `data-slot`, `data-stat`, `data-tone`, `data-layout` kept as in the reference.
- Literal class names only, so the package's own Tailwind `@source` covers them.
- Generic: no domain meaning in the package; the app keeps its meaning-to-tone table.

## Notes

- Framing: skipped. The issue gives the API, the reference markup and the acceptance.
