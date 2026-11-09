# Plan: fold-row-actions

## Phases

1. `FoldRow` takes `actions`; with it, the row is wrapped (border on the wrapper), the actions sit after the
   `<details>`, centred on the summary line; without it, the markup is byte for byte the same as before.
2. Tests: actions rendered outside the summary and after the details, slot order, size variants, `null` keeps the plain
   row. README and CHANGELOG, version 0.14.0.
3. Gates, PR, CI, merge, release theme-notion 0.14.0 through `auto-release`.

## Evidence

- p1/p2: `npx vitest run themes/theme-notion` green; existing FoldRow tests unchanged and green (markup unchanged
  without actions); a screenshot of the adopting app's list with the row open and closed.
- p3: CI green on the PR, merge SHA, the `auto-release` run and the published version.

## Decisions (auto)

- Beside the details rather than an absolutely positioned overlay: an overlay needs the summary to reserve an unknown
  width; the flex wrapper sizes itself.
- No new gallery case: the component's visual baseline stays the same; the new layout is covered by markup tests and
  the adopting app's screenshot.

## Progress

- [x] p1 `actions` prop: `FoldRow` wraps the details and the actions only when `actions` is given; existing FoldRow tests unchanged and green
- [x] p2 three markup tests (slot order, outside the summary, size, null); README, CHANGELOG 0.14.0; `npx vitest run themes/theme-notion` 1149 passed; typecheck, eslint, language gate green; screenshot of the adopting app's clips list (open and closed rows) checked
- [x] p3 pre-push full suite 824 files passed; PR #1221 checks green on ab9533e, merged as b56f0a3; `auto-release` started theme-notion@0.14.0
