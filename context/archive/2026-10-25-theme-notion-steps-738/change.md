---
change_id: theme-notion-steps-738
title: "theme-notion: Steps, numbered stages with a state (issue #738)"
status: archived
roadmap_item: null
issue: 738
branch: claude/project-thread-ptq4g9
created: 2026-10-25
updated: 2026-10-25
archived_at: 2026-10-25
---

## Intent

Close [issue #738](https://github.com/SOFTURE/AI/issues/738): export a `Steps` composition for an ordered process (the
stages of a multi-step task, the phases of a migration, the steps of one run). Each step shows a number badge, a
title, an optional note, an optional aside and a state colour, in two layouts: `row` (a wrapping grid of cards) and
`list` (a compact vertical list).

## Context

Labels: `enhancement`, `pkg: theme-notion`. No version bump in this change: the coordinator releases theme-notion.

## Constraints

- Server component: no client state.
- An `<ol>`; `data-slot="steps"`, `data-step`, `data-state`; the current step carries `aria-current="step"`.
- Literal class names only, so the package's own Tailwind `@source` covers them; design tokens only.
- A state never reads by colour alone: each step carries its state as a word for assistive technology, from the
  built-in English copy, replaceable by a prop.

## Notes

- Framing: skipped. The issue gives the API, the look and the acceptance.
