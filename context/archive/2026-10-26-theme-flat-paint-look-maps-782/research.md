# Research: Flat Paint look maps for five ui components (issue #782)

## Findings

- The theme ships look maps in `themes/theme-flat-paint/src/look/*.ts` as string literals (Tailwind sources through
  `softureTheme.sources: ["./look"]`), with local slot types (`CheckboxSlot`); it does not import ui types (ui is only
  a devDependency), so the new maps declare their slot unions locally too.
- `Hint` (`foundation/ui/src/ui/hint.tsx`): slots `root | trigger | bubble`; `HintAppearance = Pick<HintProps,
  "classNames" | "triggerGap" | "isWide">`, so the map can be a whole appearance object (`triggerGap: 8`). Trigger
  default has `focus-visible:outline-2 … outline-focus`; bubble `rounded-control` (8 px).
- `Checklist`: slots `root | progress | list | item | row | marker | body | label | link | description | trailing`.
  The marker and label take a per-state default (`MARKER_DONE` / `MARKER_OPEN`, `LABEL_DONE` / `LABEL_OPEN`) plus the
  one slot class for every state. The `<li>` carries `data-done`, so the done look is an `in-data-done:` variant.
  The list has `gap-2`, which a hairline list drops.
- `Stepper`: slots `root | progress | list | item | connector | step | marker | label`; per-state marker and step
  defaults (`MARKER_LOOK`, `STEP_LOOK`), the `<li>` carries `data-state="done|current|upcoming"`, so states are
  `in-data-[state=…]:` variants. Hover on a done marker needs a group on the step (`group/step`).
- `DisclosureMenu`: slots `root | trigger | label | panel`; `AccountMenu` and `MobileMenu` extend them, so one map
  with `trigger` and `panel` fits all three. The panel motion is `transition-[opacity,translate]` with
  `starting:` / `data-[state=closed]:` `-translate-y-1` and `opacity-0`, at `--sft-duration-fast`. The panel radius is
  `rounded-card`, which the bridge sets to 12 px (`rounded-xl`), so the issue's radius is already ui's.
- `ColorField`: slots add `presets | preset | row | swatch | input`; `preset` is a round `size-7` swatch with an
  `aria-checked:ring-2` ring; `swatch` is the native `<input type="color">`, `size-10` on `bg-surface`.
- Tailwind 4.3.3 is installed: `in-*`, `not-sr-only`, `starting:` and arbitrary `scale-[…]` all exist. Tailwind's
  default radius scale (`rounded-md`) stays; only the palette is cleared.
- Theme tokens present: `accent-fill-hover`, `line-strong`, `--duration-slow`, `ease-out-soft`.

## Conclusion

Add one module per component under `src/look/`: `hint.ts`, `checklist.ts`, `stepper.ts`, `menu.ts`, `color-field.ts`,
each a `Record<Slot, string>` limited to the slots that differ (HINT_LOOK as a `HintAppearance`-shaped object). Export
them from the root, cover them in `tests/index.test.ts` and `tests/theme-css.test.ts` (classes generated), document
them in the README table and CHANGELOG `Unreleased`.
