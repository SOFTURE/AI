# Plan: theme-notion modal surfaces on popover (#1310)

## Approach

Swap `bg-background` for `bg-popover text-popover-foreground` on the three modal content components, keep the
upstream-delta and slot-snapshot fixtures in step, and pin the surface with tests.

## Phases

### Phase 1: surfaces (test-first)

- Tests: a new `tests/ui/modal-surface.test.tsx` checks that `dialog-content` carries `bg-popover` and
  `text-popover-foreground` and not `bg-background`, and
  `alert-dialog-content` and `sheet-content` (every `side`) the same way.
- `src/ui/dialog.tsx`, `src/ui/alert-dialog.tsx`, `src/ui/sheet.tsx`: the class swap.
- `tests/upstream/deltas.ts` (`ours` strings, a new sheet delta) and `tests/fixtures/notion-slots.json` follow.
- `src/notion/Document.tsx`: the full-screen `DocumentViewer` keeps `bg-background text-foreground` (no page behind it to stand out from).
- CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes, `npm run typecheck` and `npm run lint` pass.

### Phase 2: version

- `npm run release:version -- theme-notion patch` (0.21.1); restore the lockfile's dev flags from master and drop the
  local tag (the release workflow tags).
- Done when: `themes/theme-notion/package.json` reads 0.21.1 and the CHANGELOG section is `## 0.21.1`.

## Progress

- [x] Phase 1: surfaces (4ab9822)
- [x] Phase 2: version (13d7ea6)
