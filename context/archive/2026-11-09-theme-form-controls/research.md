# Research: theme-form-controls

- `src/ui/input.tsx`: `h-7`, styles the native file button through `file:` classes; the button text and the "no file"
  text are the browser's, in its language.
- `src/ui/select.tsx`: `SelectTrigger` is `h-7` at `size="default"` and `h-6` at `size="sm"`; `Input` has no small
  size, so a form with `size="sm"` selects is uneven. Default sizes already match (28 px): the form rule is "default
  size in a form", documented, and a test pins the equal heights.
- `src/ui/field.tsx`: `Field` is a flex column with `gap-3`; `FieldDescription` carries `nth-last-2:-mt-1` and
  `last:mt-0` margins. Two `Field`s side by side in a CSS grid each lay out on their own, so a two-line label in one
  column pushes its control below its neighbour's.
- CSS subgrid (Chromium 117, Safari 16, Firefox 71) lets each field span N rows of the parent grid and share the row
  tracks: label row, control row, hint row line up across the columns.
- `src/notion/Upload.tsx`: `UploadField` (drop area, touch button) is for uploads of many files; reused patterns: hidden
  native input, `messages` override merged over `en`.
- Inventory, parity, render and messages tests require: README mention, root export, a gallery case, the parity
  fixture refreshed, every message key covered in `tests/behaviour/messages.test.tsx`; visual baselines for new cases.
