---
change_id: theme-notion-dialog-wide-902
status: archived
---

# Plan: wide dialog and footer close label (issues #902, #903)

Input: change.md, research.md. Complexity: small (one component, its tests, guards, docs).

## Phase 1: props (TDD)

Files: `themes/theme-notion/src/ui/dialog.tsx`, `tests/ui/dialog.test.tsx`, `tests/upstream/deltas.ts`,
`tests/gallery/cases.tsx`, `tests/fixtures/notion-slots.json`, `visual/baselines/**`.

- `DialogContent size?: "default" | "wide"` (default `"default"`); `wide` adds `lg:max-w-1/2` after the static
  classes, before the caller's `className`.
- `DialogFooter closeLabel?: string` (default `messages.dialog.close`) as the close button's text.
- Tests: default content has `sm:max-w-lg` and no `lg:max-w-1/2`; wide has both and keeps
  `max-w-[calc(100%-2rem)]`; footer button named "Anuluj" with the prop and "Close" (the message) without.
- Gallery case `Dialog[size=wide]`; regenerate the fixture and the visual baselines; deltas list the changed lines.

## Phase 2: docs

`themes/theme-notion/README.md` (copy props list: `DialogFooter closeLabel`; component notes: `size="wide"`),
`CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- One change for both issues: same file, same release.
- Plain conditional class, not `data-size` (research option 1).
- The optional scrolling body slot is left out; acceptance does not need it.
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: props, de518e8
- [x] Phase 2: docs and baselines, 7741160
- [x] Implementation review: approved
