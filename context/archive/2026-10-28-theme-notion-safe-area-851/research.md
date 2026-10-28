---
change_id: theme-notion-safe-area-851
---

# Research: safe-area insets (issue #851)

## Findings

- `grep safe-area` over `themes/theme-notion/src` and `themes/theme-kit/src`: no hit (as the issue says).
- `src/ui/sheet.tsx`: `SheetContent` has no padding of its own (header and footer carry `p-4`); it is `fixed` at one
  edge per `side`: `right`/`left` span the full height (`inset-y-0`), `top`/`bottom` the full width (`inset-x-0`). The
  close button sits at `top-4 right-4` of the content.
- `src/ui/sidebar.tsx`: on a phone the sidebar is a `SheetContent` with `className="... p-0 ..."`. `cn` uses
  tailwind-merge, so that `p-0` would drop any `pt-*`/`pb-*` the sheet adds. The `p-0` is upstream noise (the sheet
  has no padding).
- `src/ui/select.tsx`: `SelectContent` caps its height at `--radix-select-content-available-height` (popper mode), which
  is the room to the viewport edge minus Radix's collision padding (10 px default). `collisionPadding` takes pixels
  only, so `env()` has to go into the CSS `max-height`; `data-side` says which edge the list grows towards.
- `src/notion/PageFrame.tsx`: `min-h-dvh` page root without padding; its content (the package pages) is centred cards.
- `DialogContent` is centred with a margin: out of scope, as the issue says. `SidePanel` is absolutely positioned inside
  an app container, not at a screen edge: out of scope.
- Tailwind v4 accepts `pt-[env(safe-area-inset-top)]` and `calc()` with `--spacing()` inside arbitrary values;
  `tests/tailwind-classes.test.ts` checks every class generates CSS.
- `tests/fixtures/notion-slots.json` records rendered classes (`UPDATE_FIXTURES=1`); visual baselines render with
  insets of 0, so the screenshots do not change.

## Options

1. Classes per component (chosen): small, local, matches the issue's proposal.
2. A shared `safe-area` utility in theme-kit's generated CSS: touches another package mid-release and every theme;
   deferred (see Decisions in plan.md).
