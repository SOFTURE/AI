# Implementation review: theme-notion-checkbox-indeterminate

Verdict: approve. The diff matches the plan: the root adds the four `data-[state=indeterminate]` classes mirroring the
`checked` ones (dark included); the indicator carries `group/checkbox-indicator` and renders the tick and a lucide
minus, each shown by the indicator's own `data-state`. Checked cases: `checked` keeps the tick shown and the minus
hidden; `indeterminate` shows the minus, hides the tick, fills the box with `primary` (unit tests, red first, and the
Chromium check on the gallery in light and dark); unchecked renders no indicator, as before; the uncontrolled box
leaves `indeterminate` on click through Radix, and the icon follows because it reads `data-state`, not props. The
upstream guard lists the import and the indicator as deltas with reasons, and the #735 drift fixture names the new
tick line, so the guard still catches that drift. Only the checkbox slots changed in the parity fixture and only
`gallery.png` was re-baselined. README, CHANGELOG `Unreleased` and the Design System artifact (v105-106) follow.
