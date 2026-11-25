---
change_id: theme-notion-badge-data-color
title: "theme-notion: Badge names its colour in data-color, like Status (issue #1482)"
status: archived
roadmap_item: null
issue: 1482
branch: claude/project-thread-dfhpxs
created: 2026-11-25
updated: 2026-11-25
archived_at: 2026-11-25
---

## Intent
`Badge` renders `data-color="<colour>"` when it is given a palette `color`, next to its `data-variant`, so a browser
test checks a filled tag's colour the same way it checks a `Status` (`[data-color=red]`). Issue #1482
(`pkg: theme-notion`).

## Context
`Status` sets `data-color={color}` on the badge it renders; `Badge` itself only adds classes (`bg-red-tag`). An
adopting app that moved results from `Status` to filled tags rewrote its checks and added its own `data-tone` to every
badge. `Badge` already sets `data-variant`.

## Scope
- `Badge` sets `data-color` to its `color` prop when one is given (`none`, `null` and a missing prop set nothing).
- A caller's own `data-color` still wins (`Status` keeps passing its own).
- Tests (red first), the upstream delta, the parity fixture when it changes, README, CHANGELOG `Unreleased`.
- Out of scope: the result badge of #1481 (its own thread adds its attributes), a `data-tone` alias.

## Decisions (auto)
- One attribute name, `data-color`, the one `Status` uses; no `data-tone` alias (the issue asks that both components
  name their colour the same way).
- `data-color` mirrors the prop on every variant, destructive included: the attribute says what was asked, and
  `data-variant` tells a destructive badge apart.
- `none` sets no attribute: it is the "no colour" default, not a colour.
- Minor-level addition, recorded under `Unreleased`; the release follows the coordinator's rules.

## Notes
- research skipped: the gap (one missing attribute in one file) and its shape are named in the issue; `Status` is the
  pattern to copy.
- frame skipped: a reported gap with one proposed shape.

## Done
`Badge` renders `data-color="<color>"` next to `data-variant` when it has a palette colour (none for `none` or no
colour; a caller's own `data-color` wins), so a filled tag's colour is checked as a `Status` is
(`[data-color=red]`). Tests (red first), upstream delta, README and CHANGELOG `Unreleased`; ships in the next
theme-notion release. An adopting app drops its own `data-tone`/`data-color` on badges.
