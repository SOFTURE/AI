---
change_id: theme-notion-timeline-838
---

# Research: theme-notion Timeline (issue #838)

Read on master cda7e5f (theme-notion 0.6.0).

- Compositions live in `themes/theme-notion/src/notion/`, each re-exported by name from `src/index.ts` and tested
  with `renderToStaticMarkup` in `tests/notion/`. `softureTheme.sources` covers the folder, so literal classes there
  reach the app's CSS.
- Closest precedent: `Steps` (archive `2026-10-25-theme-notion-steps-738`): an `<ol aria-label>` built from an items
  array, `data-slot` per part, literal class maps per state. `Timeline` follows the same shape (`label`, `items`).
- Palette: `PALETTE_COLORS` / `PaletteColor` (`src/notion/palette.ts`). Each colour has `<c>` (text and fill),
  `<c>-bg`, `<c>-tag` and `<c>-tag-foreground` tokens; `Status` keeps a literal `text-<c>` map.
- Text styles (`src/tokens.ts`): `ui` and `ui-medium` 14/20, `small` 12/16. List-row hover is `hover:bg-accent` with
  `transition-colors duration-120` (`Steps` list, `FoldRow`); the focus ring is
  `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`.
- Rail colour: `border` (#e9e9e7) is too faint for a 1 px line that carries the eye; `accent-strong` (16 % / 10 %
  translucent) reads in both schemes and the markers are opaque, so the line never shows through a marker.
- `data-*` pass-through: `MarkPopover buttonData` types it as ``Readonly<Record<`data-${string}`, string | undefined>>``.
- Icons: Lucide components with `ICON_STROKE_WIDTH` (`Status` takes `icon: LucideIcon`).
- Tests: render (`tests/render.test.tsx`) and parity (`tests/parity.test.tsx`, fixture `notion-slots.json`) run over
  every gallery case; the `themes` workflow compares the visual gallery with `visual/baselines/*` (four projects).
- CHANGELOG has `0.6.0` on top and no `Unreleased` section.
