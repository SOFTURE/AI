# Plan: theme-notion-dialog-form-size

## Approach
In `src/ui/dialog.tsx`:
- `DialogContent` `size` gains `"form"`: `max-h-[calc(100dvh-2rem)] overflow-y-auto md:max-w-2xl` (the base keeps
  `sm:max-w-lg` and the phone gutter); a comment says what it is for.
- `DialogFooter` gains `sticky?: boolean` (default `false`); when set it adds
  `sticky -bottom-6 -mx-6 -mb-6 border-t border-border bg-popover px-6 py-4` and `data-sticky`.
The upstream deltas, the parity fixture, README (dialog line) and CHANGELOG `## Unreleased` describe it.

## Phases
### Phase 1: form size and sticky footer (TDD)
- Tests first (red): `tests/ui/dialog.test.tsx` asserts `size="form"`'s classes (gutter, `sm:max-w-lg`,
  `md:max-w-2xl`, `max-h-[calc(100dvh-2rem)]`, `overflow-y-auto`, no fixed height, no `lg:max-w-1/2`), and the footer's
  sticky classes only with `sticky`, keeping the column-reverse order. Gallery case `Dialog[size=form]` with enough
  fields to scroll on a phone and a sticky footer.
- Code, deltas, parity fixture (`UPDATE_FIXTURES=1`), gallery baselines, README, CHANGELOG.
- Evidence: in Chromium at 1280 x 400 and 390 x 600, the dialog is 672 px (desktop) / viewport minus 32 px (phone)
  wide, its height capped at the viewport minus 32 px, it scrolls, and the footer's bottom equals the dialog's bottom
  at scroll top and at scroll end; on the phone the buttons are full width, primary on top.
- Done when: `npx vitest run themes/theme-notion` passes, `visual/gallery.spec.ts` passes, typecheck, lint and build
  pass.

### Phase 2: Design System artifact
- Patch `DialogContent` and `DialogFooter` in the artifact's `bundle.js` (and `bundle.css` for missing classes), add a
  form dialog example to the Dialog card, publish, render-check.

## Decisions (auto)
- An explicit `DialogFooter sticky` (research, option 1), usable in every scrolling size.
- `md:max-w-2xl` (672 px; 624 px of fields), the issue's first proposal, from the Tailwind scale like the other sizes.
- Release: a minor (new props, no change for existing callers, no dependent range broken).

## Progress
- [x] Phase 1: form size and sticky footer (TDD) (red first: the 3 new class tests in `tests/ui/dialog.test.tsx`
  failed (no `form` size, no sticky footer); after: `npx vitest run themes/theme-notion` 1474 passed (parity fixture
  regenerated with `UPDATE_FIXTURES=1`, only the new `Dialog[size=form]` entry added), `visual/gallery.spec.ts` 156
  passed with only the 4 new `Dialog-size-form-.png` baselines written (axe clean); Chromium on the gallery case,
  after the open animation: desktop 1440 x 900 the dialog is 672 px wide and 868 px high (viewport minus 32), scroll
  height 920, the footer's bottom equals the dialog's (884) at scroll top and at scroll end, Cancel then the primary
  in a row; phone 390 x 844 the dialog is 358 x 812, both buttons 310 px (full width inside `p-6`), the primary on
  top (748 vs 784), the footer's bottom equals the dialog's (828); typecheck, ESLint, the language gate and
  `npm run build` passed)
- [x] Phase 2: Design System artifact (version 107-108: `DialogContent` gains the `form` class string and
  `DialogFooter` (`ZG`) the `sticky` prop with `data-sticky` in the minified `bundle.js`; 4 rules (`-bottom-6`, `-mx-6`,
  `-mb-6`, `md:max-w-2xl` with a `42rem` fallback, since the bundle defines no `--container-2xl`) appended to
  `bundle.css` as a trailing `@layer utilities{}` (diffed with postcss against the gallery's compiled css); `form` and
  `sticky` in `index.d.ts`; the Dialog card describes both, a new DialogForm card shows the form dialog; rendered in
  Chromium (headless shell 1243) at 1280 x 420 light and 390 x 420 dark: dialog 672 / 358 px wide, capped at 388 px
  and scrolling, the footer `position: sticky` with a 1 px top border, its bottom equal to the dialog's at scroll top
  and end, phone buttons 310 px with the primary on top, no page error)
