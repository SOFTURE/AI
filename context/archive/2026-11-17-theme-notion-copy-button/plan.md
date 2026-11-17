# Plan: CopyButton (theme-notion)

## Approach

One client composition over `Button`, with its words in the message layer, tested like the other compositions.

## Phases

### Phase 1: component (test-first)

- `tests/notion/CopyButton.test.tsx`: renders a `secondary` `type="button"` with a hidden icon and "Copy", no value in
  the name; a click writes the value, says the app's copied word, calls `onCopied`, goes back after
  `COPY_BUTTON_RESET_MS`; the English "Copied" by default; a refused write changes nothing; variant, size, classes kept.
- `src/notion/CopyButton.tsx`, `src/index.ts`, `src/messages/en.ts` (`copy`); the message-layer case
  (`tests/behaviour/messages.test.tsx`), the gallery case, the parity fixture.
- Done when: `npx vitest run themes/theme-notion` passes; typecheck and ESLint clean.

### Phase 2: docs, baselines, version

- README (component list, copy props, a section with an example), CHANGELOG; the inline gallery baselines refreshed
  (the only images the new case changes); `npm run release:version -- theme-notion minor` (0.24.0).
- Done when: the visual suite passes on every project and the version is 0.24.0.

## Progress

- [x] Phase 1: component
- [x] Phase 2: docs, baselines, version

Evidence: `npx vitest run themes/theme-notion` 65 files, 1279 tests green; `tsc -p themes/theme-notion --noEmit` and
ESLint clean; the visual suite (184 cases, 4 projects) green after refreshing only the four `gallery.png` baselines
(Chromium 1243 with the package's fonts: before the refresh every isolated case already matched, only the inline
gallery differed, by the new case).
