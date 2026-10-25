---
change_id: theme-flat-paint-765
status: archived
---

# Plan: Flat Paint theme package (issue #765)

Input: change.md, research.md. Complexity: medium (one new package, no change to existing packages).

## Phase 1: package

Files: `themes/theme-flat-paint/**`, `package-lock.json`.

1. `tests/fixtures/flat-paint-tokens.json`: the design system's token values, no prose, English position names.
2. `src/tokens.ts`: `FLAT_PAINT_THEME` / `theme` from the snapshot (references written out, whole-token references
   as aliases), then the shadcn roles as aliases; `clearDefaultPalette: true`. Test: equal to the snapshot, the
   aliases name own colours, every shadcn role defined.
3. `src/sft-bridge.css`: every colour, font, radius and shadow token of ui plus the two chart lines, on every scheme
   scope, unlayered. Test against ui's `SCHEME_TOKENS` / `SHARED_TOKENS`.
4. `src/page.css`: `color-scheme` per scope, motion tokens and easings, body tracking, placeholder, selection, the
   `figure`, `num`, `tabular`, `card-surface` classes, reduced motion.
5. `src/look/*`: the class maps and `ROLE_TONE`, `softureTheme.sources: ["./look"]`.
6. Tests: tokens, contrast (WCAG 2.2 AA in both schemes), bridge, theme CSS compiled by the Tailwind CLI, barrel.
7. README (theme-notion's shape), CHANGELOG `Unreleased`.

## Phase 2: repository

Root README lists the package; `release-tags` count 28 → 29.

## Decisions (auto)

- No components: the adopting app's components are ui's; class maps carry the look deltas, so a second app on ui
  gets the same look without wrappers of its own.
- `muted` and `accent` keep the design system's meaning (text colours) while they satisfy the shadcn role names;
  documented in the tokens file and the README. A raised background is `secondary`.
- Position colours renamed to English in the snapshot (the language gate; identifiers are English), and in the
  design system by the adopting app's change.
- Version 0.0.0 with an `Unreleased` changelog; `release:version` makes it 0.1.0 at release.

## Progress

- [x] Phase 1: package (tests 38/38)
- [x] Phase 2: root README, release-tags 29
