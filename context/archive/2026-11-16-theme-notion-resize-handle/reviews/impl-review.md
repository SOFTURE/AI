# Implementation review: theme-notion-resize-handle

- Drift from plan: none.
- `onCommit` fires only when the width changed (a click without a move, End at the maximum, a double click at the
  default keep nothing); covered by tests.
- A drag from another pointer id or a secondary button is ignored; covered.
- Tailwind generation and parity: green; `z-4` sits above `SidePanel`'s `z-3` so the handle stays grabbable over its
  border.
- Verdict: approve.
