# Plan: theme-notion StatCard progress bar (issue #739)

## Phase 1: progress on StatCard

Files: `themes/theme-notion/src/ui/progress.tsx`, `src/notion/Stats.tsx`, `tests/notion/Stats.test.tsx`, `README.md`,
`CHANGELOG.md` (Unreleased).

1. `Progress` takes an optional `indicatorClassName`, merged over `bg-primary` with `cn`, so a caller can recolour the
   indicator.
2. `StatCard` gets `progress?: number` and `progressLabel?: string`. When `progress` is given, the card draws
   `<Progress data-slot="stat-card-progress">` right under the figure (above the hint), value clamped to 0–100 (a
   non-finite value counts as 0), `aria-label` = `progressLabel ?? label`, indicator `TONE_FILL[tone]` when the card
   has a `tone`, else primary. The left column gets `flex-1` only then, so the bar spans the card beside an aside.
3. Tests: no `progressbar` without `progress` (existing exact-markup tests stay green), bar with `aria-valuenow` and
   accessible name, `progressLabel` override, tone colour vs primary, clamping below 0 and above 100.
4. README and CHANGELOG.

## Decisions (auto)

- An `indicatorClassName` prop on `Progress` instead of an arbitrary child selector from `StatCards`: the selector
  would fight `bg-primary` on specificity and order; a prop is explicit and additive.
- An explicit `tone: "default"` takes `TONE_FILL.default` (gray), as the issue says "from `TONE_FILL` when a tone is
  set"; no tone keeps the primary bar.
- No version bump: the coordinator releases in a batch.

## Progress

- [ ] Phase 1: progress on StatCard
