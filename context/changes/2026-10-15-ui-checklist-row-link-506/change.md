---
change_id: ui-checklist-row-link-506
title: "ui: Checklist rows as whole links with a trailing adornment, and linked done items (issue #506)"
status: active
roadmap_item: null
issue: 506
branch: claude/project-thread-hhvivv
created: 2026-10-15
updated: 2026-10-15
---

## Intent

Close [issue #506](https://github.com/SOFTURE/AI/issues/506) (labels `enhancement`, `pkg: ui`, `adoption`): an
adopting app moves its onboarding checklist onto `Checklist` without a visible change. It needs the whole row as the
link target (`rowLink`), content after the body such as a chevron (`trailing`), and links on done items (`linkDone`).

## Context

ui is at 0.3.0 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`. Issue #507 also touches ui; this change merges fresh master before it merges.

## Constraints

- All three are opt-in; without them the markup and classes stay as today.
- The screen-reader suffix ("(done)" / "(to do)") stays and stays overridable through `messages`.
- No new copy: every visible word comes from the app or from the existing `checklist` messages.

## Notes

- Framing: skipped. The issue names the three gaps and the prop shapes.

## Decisions (auto)

- Prop names as proposed: `rowLink`, `trailing`, `linkDone` (all default off).
- `trailing` is a node or a function `(item, { isLink }) => node`, so an app can draw the chevron only on rows that
  open something.
- With `rowLink` the link wraps marker, body and trailing inside the `<li>`, gets a new `row` slot (row layout, focus
  ring, hover tint, no underline) and the label keeps the label look; the `link` slot is used only without `rowLink`.
- A row with no link (no `href`, or done without `linkDone`) renders as today, with `trailing` after the body.
