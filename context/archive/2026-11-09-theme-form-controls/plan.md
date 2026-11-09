# Plan: theme-form-controls

## Steps

1. `src/notion/FileInput.tsx`: `FileInput` (outline button look at `h-7`, the chosen file's name or "No file chosen",
   a visually hidden but focusable native input that the label and the button open; `accept`, `multiple`, `disabled`,
   `name`, `aria-invalid`, `aria-describedby`; `fileName` overrides the shown name; `onFilesSelected(files)`;
   `messages`). Copy `notionMessages.en.fileInput`.
2. `src/notion/FormGrid.tsx`: `FormGrid` (`columns` 1–3, `rows` per field, default 3): every child `Field` spans
   `rows` row tracks; vertical fields become subgrids so label, control and hint share the rows across columns.
3. Exports, README (component list and a section, the form height rule), CHANGELOG 0.15.0, version bump.
4. Tests: behaviour of both (pick, name, override, disabled, label opens, keyboard focus, rows and columns), messages
   cases, a test pinning equal default heights of `Input`, `SelectTrigger` and `FileInput`, gallery cases, parity
   fixture, visual baselines.

## Progress

- [x] 1 `FileInput`: the visible part is a `button` with `tabIndex=-1`, `aria-hidden` and `disabled` (axe: a disabled
  control is exempt from contrast, a span at half opacity was not), the native input before it as the focus `peer`.
- [x] 2 `FormGrid`: subgrid rows; the first part of a vertical field (its label) aligns to the end of its row, so a
  one-line label sits on its control beside a two-line one.
- [x] 3 exports, README, CHANGELOG 0.15.0, version and lockfile.
- [x] 4 `npx vitest run themes/theme-notion`: 59 files, 1175 tests passed; coverage 97.83 % statements, 95 % branches
  (FileInput and FormGrid 100 %); `npm run test:visual` with Playwright's chromium 1254 (Chrome for Testing
  158.0.8127.18, the build of the baselines): 160 passed, the four `gallery.png` baselines refreshed (new cases only;
  every other baseline passed unchanged), axe clean; typecheck, ESLint and the language gate clean.

## Decisions (auto)

- Subgrid over fixed label heights: it follows the real content (a wrapped label, a two-line hint).
- No new `Input`/`SelectTrigger` size: the default sizes already match; the README states the rule instead.
