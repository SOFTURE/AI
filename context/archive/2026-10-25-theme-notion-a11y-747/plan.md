# Plan: theme-notion ItemGroup and ScrollArea accessibility (issue #747)

## Phase 1: list items and a focusable viewport

Files: `themes/theme-notion/src/ui/item.tsx`, `src/ui/scroll-area.tsx`, `tests/ui/item.test.tsx`,
`tests/ui/scroll-area.test.tsx`, `README.md`, `CHANGELOG.md` (Unreleased).

1. `ItemGroup` provides a context; `Item` inside it renders `role="listitem"` unless `asChild`; a caller's `role`
   wins. `Item` outside a group has no role.
2. `ScrollArea` takes `viewportProps`; the viewport renders `tabIndex={0}` before them.
3. Tests: listitem inside a group, none outside, none with `asChild` (the child keeps its tag), caller role wins;
   viewport `tabIndex="0"` by default and `-1` through `viewportProps`.
4. README: both deltas in "Deltas from stock shadcn". CHANGELOG entry.

## Decisions (auto)

- Keep `role="list"` and add list items (the issue's first option): it keeps the semantics.
- `asChild` items get no role, so a link inside a group stays a link; documented.
- `viewportProps` over a single `viewportTabIndex`: one prop covers any viewport attribute an app needs.
- `tests/upstream/deltas.ts` and the gallery's known-violation entries belong to #741 (not on master); the thread of
  #741 adds the deltas and drops the entries once this lands.
- No version bump: the coordinator releases in a batch.

## Progress

- [x] Phase 1: list items and a focusable viewport (d22c0d4)
