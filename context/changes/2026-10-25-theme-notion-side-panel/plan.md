---
change_id: theme-notion-side-panel
status: in_progress
---

# Plan: theme-notion SidePanel (issue #724)

Input: change.md, research.md. Complexity: small (one new component, no change to existing ones).

## Phase 1: component, tests, docs

Files: `themes/theme-notion/src/notion/SidePanel.tsx`, `src/index.ts`, `src/messages/en.ts`,
`tests/notion/SidePanel.test.tsx`, `README.md`, `CHANGELOG.md`.

1. `SidePanel` (client component) with the issue's markup and classes unchanged; `SidePanelLayout` type and
   `SidePanelProps`; `closeLabel` optional, default `en.sidePanel.close` ("Close").
2. Export `SidePanel`, `SidePanelLayout`, `SidePanelProps` from the barrel.
3. Tests (happy-dom): hidden while closed; `data-slot`, `data-layout`, `data-testid`, `aria-labelledby`; focus moves
   in when it opens but not when open on first render; Escape inside and the close button call `onClose`, Escape
   does not bubble; default and custom close label.
4. README (compositions, copy props, a usage note on the parent row), CHANGELOG `Unreleased`.

## Decisions (auto)

- `closeLabel` optional with an English default from `messages/en.ts`: the issue allows it and it matches
  `SheetContent closeLabel`.
- Placed in `src/notion/` (a composition), not `src/ui/` (shadcn files only; the barrel test counts 36).
- The class string stays byte-identical to the reference, as the issue requires the identical look.

## Progress

- [ ] Phase 1: component, tests, docs
