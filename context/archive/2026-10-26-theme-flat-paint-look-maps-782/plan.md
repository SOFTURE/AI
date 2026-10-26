# Plan: Flat Paint look maps for five ui components (issue #782)

## Phase 1: the five look maps

Files: `themes/theme-flat-paint/src/look/{hint,checklist,stepper,menu,color-field}.ts`, `src/index.ts`,
`tests/index.test.ts`, `tests/theme-css.test.ts`, `README.md`, `CHANGELOG.md`.

1. Tests first: the root exports the five maps with the slots the issue names; the compiled CSS contains their
   state variants (`in-data-done:`, `in-data-[state=current]:`, `starting:scale-[0.98]`, `aria-checked:border-
   foreground`).
2. `HINT_LOOK`: `{ triggerGap: 8, classNames: { trigger, bubble } }` (trigger `text-[10px] transition
   focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`, bubble `rounded-md`).
3. `CHECKLIST_LOOK`: list hairlines without the gap, row hover and focus ring, marker `line-strong` → `accessible`
   at 20 % when done, done label normal weight, `muted`, struck through.
4. `STEPPER_LOOK`: marker `size-8 sm:size-10`, idle `line-strong` on `background`, current `accent` border, text and
   1 px outline offset 2, done `accent-fill` / `on-accent` with `accent-fill-hover` on hover; label `sr-only` below
   `sm`, bold `foreground` when current.
5. `MENU_PANEL_LOOK`: trigger `BUTTON_VARIANT_LOOK.ghost`, panel `p-1.5 shadow-none` and the opacity + scale entrance
   at `--duration-slow` / `ease-out-soft`.
6. `COLOR_FIELD_LOOK`: square presets with a 2 px `foreground` frame when picked, native picker 28 × 36 px in
   `line-strong` on `surface-raised`.
7. README look-map table rows and a usage line; CHANGELOG `## Unreleased`.

## Decisions (auto)

- Slot unions are declared in the theme (like `CheckboxSlot`), not imported from ui, which is only a devDependency.
- State looks use `in-data-*` variants on the `<li>` state ui already sets, so no ui change is needed.
- The panel radius is left out: ui's `rounded-card` is already 12 px through the bridge (`rounded-xl` would repeat it).
- "28 × 36 px" read as width × height: `w-7 h-9`.
- No version bump: the coordinator releases.

## Progress

- [x] Phase 1: the five look maps (0bf7310)
