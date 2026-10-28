---
change_id: theme-notion-safe-area-851
status: archived
---

# Plan: safe-area insets (issue #851)

Input: change.md, research.md. Complexity: small.

## Phase 1: components (TDD)

Files: `src/ui/sheet.tsx`, `src/ui/sidebar.tsx`, `src/ui/select.tsx`, `src/notion/PageFrame.tsx`,
`tests/upstream/deltas.ts`, `tests/behaviour/overlays.test.tsx` (or a new `tests/behaviour/safe-area.test.tsx`),
`tests/fixtures/notion-slots.json`.

1. Tests first: per sheet side the inset classes on the touched edges only; the close button offset by the top and
   right insets where those edges touch the screen; the mobile sidebar keeps the insets; popper `SelectContent` caps
   its height by the inset of the side it grows towards; `PageFrame` pads all four insets.
2. `SheetContent`: `right` → `pt/pr/pb` insets, `left` → `pt/pl/pb`, `top` → `pt/pl/pr`, `bottom` → `pb/pl/pr`. Close
   button: `top-[calc(--spacing(4)+env(safe-area-inset-top))]` unless `bottom`, `right-[calc(--spacing(4)+env(safe-area-inset-right))]`
   unless `left`.
3. `Sidebar` (mobile): drop the `p-0` that would merge the insets away.
4. `SelectContent`: `data-[side=bottom]:max-h-[calc(var(--radix-select-content-available-height)-env(safe-area-inset-bottom))]`
   and the same for `top`.
5. `PageFrame`: padding by the four insets.
6. List the deltas, refresh the fixture.

## Phase 2: docs

README (a short "Installed on a phone" note: what the theme pads, and the classes for an app's own screen roots),
CHANGELOG `## Unreleased`.

## Phase 3: design system artifact

Mirror the class changes in "NOTION · Design System" (patch `bundle.js`, add the classes to `bundle.css`).

## Decisions (auto)

- Insets as padding on `SheetContent` itself, so the surface still reaches the screen edge under the home indicator.
- No shared utility class in theme-kit now: it would touch theme-kit while its release is in flight and every theme;
  the README lists the arbitrary classes for an app's own roots. A follow-up issue can add one if apps ask.
- No version bump; the coordinator releases.

## Progress

- [x] Phase 1: components (46cd893)
- [x] Phase 2: docs (6930842)
- [x] Phase 3: design system artifact, NOTION · Design System versions 32–33
- [x] Implementation review: approved
