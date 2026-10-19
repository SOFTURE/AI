---
change_id: mcp-access-token-focus-590
status: in_progress
---

# Plan: focus on the issued token and back to the name field (issue #590)

Input: change.md, research.md. Complexity: small (one component, tests, docs).

## Phase 1: move focus (TDD)

Files: `modules/mcp-access/src/ui/token-manager.tsx`, `modules/mcp-access/tests/token-manager.test.tsx`.

1. Tests first:
   - after a successful issue, `document.activeElement` is the panel heading ("Token created: Desktop") and it has
     `tabIndex` -1;
   - a second issued token while the panel is open moves focus to the new heading;
   - after "Done" and an animation frame, `document.activeElement` is the name textbox.
2. `IssuedTokenPanel`: a heading ref, `tabIndex={-1}`, `useEffect` focusing it keyed by `issued.id`.
3. `IssueForm`: a form ref; `onDone` dismisses and then, in `requestAnimationFrame`, focuses
   `form.elements.namedItem("name")` when it is an `HTMLInputElement`.

## Phase 2: docs

`modules/mcp-access/README.md` (one sentence on the focus behaviour next to `TokenManager`), `CHANGELOG.md`
`## Unreleased` (no migration needed; an app that moved focus itself around `TokenManager` can drop that code).

## Progress

- [x] Phase 1: move focus (2 tests written first and failing; 17 TokenManager tests pass; a6c56dc)
- [x] Phase 2: docs (README next to `TokenManager`, CHANGELOG `## Unreleased`)
