---
change_id: theme-notion-stat-card-icon-813
status: in_progress
---

# Plan: theme-notion StatCard icon (issue #813)

Input: change.md, research.md. Complexity: small (one component, its tests, docs, the design system).

## Phase 1: the component and its tests

Files: `themes/theme-notion/src/notion/Stats.tsx`, `tests/notion/Stats.test.tsx`, `tests/gallery/cases.tsx`.

1. `StatCard.icon?: LucideIcon`. With it, the label row is `flex items-center gap-1.5 text-section-label
   text-muted-foreground` and holds the icon (`aria-hidden`, `strokeWidth={ICON_STROKE_WIDTH}`, `size-4 shrink-0`)
   before the label. Without it, the row's markup is unchanged.
2. Tests: the icon renders before the label, `aria-hidden`, at 1.75 stroke, `size-4`; the text nodes stay the label
   and the figure; a card without `icon` keeps the exact label markup.
3. A gallery case card with an icon, so the visual and contrast suites cover it.

## Phase 2: docs

`themes/theme-notion/README.md` (StatCards paragraph and example), `CHANGELOG.md` (`Unreleased`).

## Phase 3: design system

Rebuild the "NOTION · Design System" artifact bundle (JS and CSS) from the changed source and show an icon on a
StatCards preview card; render-check in light and dark.

## Decisions (auto)

- `LucideIcon` over `ReactNode`: the card owns the size, stroke and `aria-hidden`, as `Status` does.
- No version bump: the coordinator releases in a batch.

## Progress

- [ ] Phase 1: the component and its tests
- [ ] Phase 2: docs
- [ ] Phase 3: design system
