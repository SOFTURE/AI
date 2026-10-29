---
change_id: theme-notion-touch-sizes-859
status: open
---

# Plan: touch sizes in theme-notion (issue #859)

Input: change.md, research.md. Complexity: small (two components, their tests, docs, fixtures).

## Phase 1: sizes (TDD)

Files: `themes/theme-notion/src/ui/button.tsx`, `src/ui/select.tsx`, `tests/ui/button.test.tsx`,
`tests/ui/select.test.tsx`, `tests/upstream/deltas.ts`, `tests/gallery/cases.tsx`, `tests/fixtures/notion-slots.json`.

- `Button`: `touch` = `h-touch-target px-3` with the icon-side padding of `lg`; `icon-touch` = `size-touch-target`.
- `SelectTrigger`: `size?: "sm" | "default" | "touch"`; `touch` adds the plain class `h-touch-target` (no attribute
  variant), `data-size="touch"` as for the other sizes.
- `SelectContent`: `size?: "default" | "touch"`, provided to its items through a context; `SelectItem` takes
  `size?: "default" | "touch"` (its own wins over the content's) and adds `min-h-touch-target` for `touch`.
- Tests: each new size's classes; a caller's `md:h-7`/`md:size-7`/`md:min-h-7` kept next to the touch class; items
  taking the content's size and an item overriding it; existing sizes unchanged.
- Gallery: Button axes gain the two sizes, `SelectTrigger[size=touch]`, a `Select[size=touch]` case; regenerate the
  fixture; deltas list the changed lines.

## Phase 2: docs

`themes/theme-notion/README.md` (touch sizes and the desktop fallback), `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- Plain classes, not attribute variants, for the touch heights: the desktop fallback is one caller class.
- No built-in `md:` fallback: the app picks its breakpoint (documented).
- Item size through `SelectContent` context plus a per-item prop: one prop for a whole list, the issue's alternative.
- No version bump: the coordinator releases the batch with #858.

## Progress

- [x] Phase 1: sizes, 07adda5
- [x] Phase 2: docs, 45e0df4
- [x] Implementation review: approved
