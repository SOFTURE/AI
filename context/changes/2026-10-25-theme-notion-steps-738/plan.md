---
change_id: theme-notion-steps-738
status: in_progress
---

# Plan: theme-notion Steps (issue #738)

Input: change.md, research.md. Complexity: small (one component, tests, docs).

## Phase 1: the composition

Files: `themes/theme-notion/src/notion/Steps.tsx`, `themes/theme-notion/src/messages/en.ts`,
`themes/theme-notion/src/index.ts`, `themes/theme-notion/tests/notion/Steps.test.tsx`.

1. `Steps.tsx`: `StepState`, `StepItem`, `StepsLayout`, `StepsProps` and `Steps` as the issue proposes. An `<ol>` with
   `data-slot="steps"` and `data-layout`; each `<li>` has `data-step`, `data-state` (default `todo`) and
   `aria-current="step"` when current. The number (1-based, `aria-hidden`) sits in a 20 px badge coloured by state
   from a literal class map; the state word follows as `sr-only` text. `row`: cards (`rounded-lg`, `shadow-card`, the
   current one on `blue-bg`) in a wrapping grid, round badge. `list`: rows with `hover:bg-accent`, `rounded-sm`
   badge.
2. `en.ts`: `steps: { done, current, todo, failed }`; `Steps` takes `stateLabels` to replace them.
3. Export `Steps` and its types from `src/index.ts`.
4. Tests: numbering in order; `aria-current` on the current step only; both layouts (classes and badge shape);
   default state `todo`; badge class per state; note and aside left out when absent; state words and their
   override; root export.

## Phase 2: docs

Files: `themes/theme-notion/README.md`, `themes/theme-notion/CHANGELOG.md`.

1. README: name `Steps` in "Components" with a short example; add `Steps stateLabels` to "Copy".
2. CHANGELOG: an `Unreleased` entry.

## Decisions (auto)

- State is the issue's union (`done`, `current`, `todo`, `failed`), not a `Tone`: a process needs "current".
- Badge colours: `done` `bg-green-tag text-green-tag-foreground`, `current` `bg-primary text-primary-foreground`,
  `failed` `bg-red-tag text-red-tag-foreground`, `todo` `bg-muted text-muted-foreground`; the tag pairs keep the
  number readable in both modes. In `list` the badge is `rounded-sm` with the same state colours (`todo` gives the
  issue's `bg-muted`).
- The state is also a word (`sr-only`), so it never reads by colour alone (the theme's rule for statuses).
- `layout` defaults to `row`.

## Progress

- [x] Phase 1: d7605f3
- [ ] Phase 2
