---
change_id: ui-menus-color-presets-558
status: in_progress
---

# Plan: AccountMenu trigger and leave motion, MobileMenu groups, ColorField presets (issue #558)

Input: change.md, research.md. Complexity: moderate (four additive props, one shared helper). Tests in
`foundation/ui/tests/adoption-gaps-558.test.tsx`, written first in each phase.

## Phase 1: menu trigger and leave motion

Files: `src/ui/motion-time.ts` (new, moved from `modal.tsx`), `modal.tsx`, `disclosure-menu.tsx`, `app-menus.tsx`.

1. Tests: `AccountMenu trigger` renders the node inside the button and keeps the name "Account"; without it the
   user icon stays. The panel is `hidden` with `data-state="closed"` on first render; open gives `data-state="open"`
   and no `hidden`; close sets `data-state="closed"` and keeps it shown until `transitionend`, then `hidden`;
   with no running transition it hides at once.
2. Move `getLongestTime`, `getLeaveTime`, `LEAVE_TIMEOUT_MS` to `motion-time.ts`; import them in `modal.tsx`.
3. `DisclosureMenu`: track `isLeaving`; panel `hidden` only when closed and not leaving; `data-state`; default
   classes with `transition`, `starting:`, `data-[state=closed]` and `motion-reduce:transition-none`.
4. `AccountMenu.trigger`.

## Phase 2: MobileMenu groups

1. Tests: a group renders its heading and a nested list named by it; flat items keep today's markup; mixed lists.
2. `MobileMenuGroup`, `isMobileMenuGroup`, slots `group`, `heading`, `groupList`.

## Phase 3: ColorField presets

1. Tests: no `presets` → no radiogroup; presets → a radiogroup named "Preset colours: <label>", one radio per
   preset named by its label; a click sets the text and swatch and calls `onValueChange`; the swatch matching the
   value (any case) is checked; arrow keys move and pick; the form data holds only the text field; message override.
2. `presets` prop, `colorField.presets` message, slots `presets`, `preset`.

## Phase 4: docs

`foundation/ui/CHANGELOG.md` `## Unreleased` with the migration for an app that kept its own menus and field;
README entries for the new props.

## Progress

- [ ] Phase 1: menu trigger and leave motion
- [ ] Phase 2: MobileMenu groups
- [ ] Phase 3: ColorField presets
- [ ] Phase 4: docs
