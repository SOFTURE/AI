---
change_id: theme-notion-upload-field-950
status: done
---

# Research: upload field (issue #950)

## What exists (master c9380e5)

- `Field`, `FieldLabel`, `FieldDescription`, `FieldError` (`src/ui/field.tsx`): the frame for a labelled control.
- `Button` with `touch` and `icon-touch` sizes (`h-touch-target`, `size-touch-target`): the theme's touch targets.
- `Progress` (determinate with a value), `Status` (ghost badge, palette colour, icon and word), `Steps` (state words
  for assistive technology merged from `messages.steps` and a prop), `Sortable` (copy with `{item}` placeholders).
- Copy: `src/messages/en.ts`; every text has a prop that replaces it.
- Gates on a new composition: README names it (inventory test), index exports every value of the file, the gallery
  renders it (`tests/gallery/cases.tsx`), the slot fixture `tests/fixtures/notion-slots.json` (`UPDATE_FIXTURES=1`),
  and visual baselines per viewport and scheme (`npm run test:visual -- --update-snapshots`).

## Options

1. One `Upload` component owning picker, list and state. Rejected: the issue asks for controlled, transport-free
   parts, and #949 owns the upload state.
2. Three parts: `UploadField` (picker and drop area, reports `File[]`), `UploadList` (the list frame) and
   `UploadItem` (one row from a plain item object and callbacks). Chosen.

## Details

- Picking: a native `<input type="file">` kept visually hidden and out of the tab order; a real `Button` opens it, so
  the control is a button for keyboards and screen readers on every platform. `accept`, `multiple`, `capture` pass
  through. The input's value is cleared after each pick, so the same file can be picked again after a removal.
- Drop: drag over highlights the area (`data-dragging`); a drop hands over the files that match `accept` (the picker
  enforces `accept`, a drop does not), the first one only without `multiple`; files that do not match go to
  `onFilesRejected`. The "drop here" hint shows from `md` up only, so a phone never offers what it cannot do.
- Sizes: `Intl.NumberFormat(locale, { style: "unit", unit: "byte" | "kilobyte" | "megabyte" | "gigabyte" })`, decimal
  (1000) steps, one fraction digit above bytes. `locale` defaults to `en` so server and browser render the same text.
- States and colours: queued gray (clock), uploading blue (upload arrow), paused orange (pause), done green (check),
  failed red (alert). The state word is always written, so it never reads by colour alone.
- Progress: a determinate `Progress` while uploading or paused, named "Upload of {name}" for assistive technology.
