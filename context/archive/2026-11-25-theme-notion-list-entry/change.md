---
change_id: theme-notion-list-entry
title: "theme-notion: ListEntry with a right column (state on top, actions under it) and a ResultBadge on the tones (issue #1481)"
status: archived
roadmap_item: null
issue: 1481
branch: claude/project-thread-9mzcvx
created: 2026-11-25
updated: 2026-11-25
archived_at: 2026-11-25
---

## Intent
An admin list row reads the same in every adopting app: what the row is on the left, its state and its controls in a
right column, the whole row one box that opens its target. A result reads in one colour per tone everywhere. An
adopting app drops its local list row and result badge. Issue #1481 (`enhancement`, `pkg: theme-notion`, `adoption`).

## Context
`List`, `ListItem` and `ListRow` (0.31.0) give a row its density, padding and hover, but no layout for an identity
with a state/actions column, and apps mix `Status` and `Badge variant="tag"` for one result, so "failed" is orange in
one list and red in another. Same shape as #1471 (status above the action in a `FoldRow` bar) for rows that do not
fold. The owner's comment (2026-11-25 18:47) adds: the trailing arrow stays beside the state column and never wraps
alone; a control marked `data-row-wide` makes the right column take the full width under the identity, its lines
starting on the left; the result badge can spin (`isSpinning`, `motion-safe:animate-spin`) for a run in progress.

## Scope
- `ListEntry`: slots `title`, `details` (lines under it), `status` (top of the right column), `actions` (under it);
  `href` makes the title a link stretched over the row with a trailing arrow beside the column; the column stays
  above the link. On a phone the column wraps under the identity, right-aligned, with 44 px controls. A
  `data-row-wide` control widens the column to the full row, left-aligned.
- `ResultBadge`: a filled tag in the tone's colour (`TONE_COLORS`), the tone's default icon (overridable), always a
  word, `isSpinning`.
- Tests (tone → colour map, slots, link, wide control), a Chromium measurement (badge above the controls at the
  right edge; at 390 px the column under the identity, the arrow beside it), gallery cases, the parity fixture,
  visual baselines, README, CHANGELOG `Unreleased`, the "NOTION · Design System" artifact.
- Out of scope: the adopting app; `ListRow` stays as it is.

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: a reported gap with a proposed shape and acceptance criteria in the issue and the owner's comment.

## Done
`ListEntry`: an identity (`title`, `details`) and a right column (`status` over `actions`); with `href` a stretched
title link and an arrow beside the column that never wraps alone; below `md` the column wraps under the identity with
44 px controls; `data-row-wide` widens the column to the row. `ResultBadge`: a filled tag in the tone's colour with the
tone's icon and a word, `isSpinning`. Tests (red first), two Chromium measurements, three gallery cases, parity
fixture, four gallery baselines, README, CHANGELOG `Unreleased`, the Design System artifact (v84); ships in the next
theme-notion release. An adopting app drops its local list row and result badge.
