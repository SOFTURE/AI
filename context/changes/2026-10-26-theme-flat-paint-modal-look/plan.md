---
change_id: theme-flat-paint-modal-look
status: planned
---

# Plan: Flat Paint Modal and StandingPanel look (issue #781)

Input: change.md, research.md. Complexity: small (one package, additive).

## Phase 1: motion and look maps

Files: `themes/theme-flat-paint/src/page.css`, `src/look/modal.ts`, `src/index.ts`, `tests/*`, `README.md`,
`CHANGELOG.md`.

1. `page.css`: keyframes `flat-paint-veil-in` (background from transparent), `flat-paint-sheet-in` (`translate: 0
   100%`), `flat-paint-rise-in` (opacity 0, `translate: 0 0.75rem`), `flat-paint-side-in` (`translate: 100% 0`);
   classes `veil-enter` (base duration), `dialog-enter` (sheet below 40 rem, rise from 40 rem) and
   `side-panel-enter`, slow duration, soft easing, `backwards`. No scale, no exit.
2. `look/modal.ts`: `ModalWidth`, `ModalSlot`, `MODAL_LOOK` (the dialog), `STANDING_PANEL_LOOK` (the side panel),
   `getModalLook(width)`.
3. Tests: `getModalLook` per width, the keyframes and classes in the compiled CSS, the look classes generated.
4. README look-map row and page-base line; CHANGELOG `Unreleased`.

## Decisions (auto)

- The panel slot also takes `transition-none` (R2), so ui's starting-style translate cannot fight the keyframes.
- The `page` step is the title's text style (`text-page`); the header centres the close button on that taller title
  (`items-center`).
- Class names without a `motion-` prefix (Tailwind's `motion-safe:` / `motion-reduce:` variants read like one).

## Progress

- [ ] Phase 1: motion and look maps
