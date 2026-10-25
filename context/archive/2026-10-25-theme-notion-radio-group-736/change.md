---
change_id: theme-notion-radio-group-736
title: "theme-notion: RadioGroup, shadcn radio-group with the checkbox deltas (issue #736)"
status: archived
roadmap_item: null
issue: 736
branch: claude/project-thread-8pkidy
created: 2026-10-25
updated: 2026-10-25
archived_at: 2026-10-25
---

## Intent

Close [issue #736](https://github.com/SOFTURE/AI/issues/736): `@softure-ai/theme-notion` ships the shadcn new-york v4
`radio-group` (`RadioGroup`, `RadioGroupItem`, Radix) drawn like the package's `checkbox`, so an adopting app picks
one option from a short list without drawing a radio by hand.

## Context

- Labels: `enhancement`, `pkg: theme-notion`. The package has 36 shadcn parts and no `radio-group`.
- The `checkbox` deltas: 16 px, `border-[1.5px] border-muted-foreground`, checked state in `primary`, focus
  `ring-2 ring-ring`, `aria-invalid` like the other fields.

## Constraints

- `data-slot="radio-group"`, `radio-group-item`, `radio-group-indicator` as in shadcn.
- English only, no app-specific code, no version bump (the coordinator releases in a batch).

## Notes

- Framing: skipped. The issue names the outcome, the API and the acceptance tests.
