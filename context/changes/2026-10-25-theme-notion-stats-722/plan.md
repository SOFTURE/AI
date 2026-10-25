---
change_id: theme-notion-stats-722
status: in_progress
---

# Plan: theme-notion StatsFold, StatCards, StatPills (issue #722)

Input: change.md, research.md. Complexity: small (one file of three components, tests, docs).

## Phase 1: the compositions

Files: `themes/theme-notion/src/notion/Stats.tsx`, `themes/theme-notion/src/index.ts`,
`themes/theme-notion/tests/notion/Stats.test.tsx`.

1. Wait for #720 on master and merge master in (provides `Tone`, `TONE_COLORS`, `TONE_TEXT`).
2. `Stats.tsx`: the issue's interfaces and the three components with the reference markup, verbatim classes.
3. Export the components and their types from `src/index.ts`.
4. Tests: the fold is closed by default (no `open`), carries its heading as `h2` and the content slot; `StatCards`
   `data-layout` is `grid`, `full`, `row` per flag with the matching grid classes (`isOneRow` wins); hint and aside
   are left out when absent and rendered with `data-tone` when present; a card's figure has its tone's text class
   and `default` without a tone; pills keep the given order with `data-stat` and `data-tone`.

## Phase 2: docs

Files: `themes/theme-notion/README.md`, `themes/theme-notion/CHANGELOG.md`.

1. README "Components": name the three compositions and show a short example.
2. CHANGELOG: an `Unreleased` entry.

## Decisions (auto)

- One file `Stats.tsx` for the three: they share the tone mapping and are one feature (a screen's summary figures).
- Keep the reference classes exactly (the issue requires an identical look), including `duration-120`.

## Progress

- [ ] Phase 1
- [ ] Phase 2
