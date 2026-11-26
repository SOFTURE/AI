# Plan: theme-notion-fold-row-align-start

## Approach
All in `src/notion/FoldRow.tsx`. `FoldRowProps.align?: "center" | "start"` (default `center`). With `start`: the
summary, the summary slot and the fixed heading use `items-start`; the chevron is wrapped in a `fold-row-chevron`
box `flex h-lh shrink-0 items-center text-ui`, so it is centred on the first line; the right column uses
`md:justify-start` instead of `md:justify-center`. With `center` every class and the markup stay as in 0.36.0 (no chevron box).

## Phases
### Phase 1: `align="start"` (TDD)
- Tests first (red) in `tests/notion/FoldRow.test.tsx`: with `align="start"` the summary and the slot are
  `items-start`, the chevron sits in a one-line box, the right column is `md:justify-start` and not
  `md:justify-center`, for both summary shapes; the default keeps `items-center` and `md:justify-center`.
- Code, README (`FoldRow` paragraph), CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes, typecheck, lint and build pass; a Chromium render at
  1280 px of the issue's repro shows the chevron, the title and the status on the first line.

### Phase 2: Design System artifact
- Update the bundled `FoldRow` and its types in the "NOTION · Design System" artifact, publish.

## Decisions (auto)
- An opt-in prop rather than a new default: a one-line summary in a touch-height row keeps its centred layout, and
  0.36.0 users see no change. Named `align` with `"center" | "start"` as the issue proposes.
- The chevron box is one `ui` line high (`text-ui h-lh`) instead of a fixed margin, so it follows the line height.
- Released as a minor (an additive optional prop, no dependent range broken).

## Progress
- [ ] Phase 1: `align="start"` (TDD)
- [ ] Phase 2: Design System artifact
