---
change_id: auth-logout-button-slots
title: "auth: LogoutButton and LogoutForm style their button, so an app renders logout as a sidebar row (issue #1439)"
status: archived
roadmap_item: null
issue: 1439
branch: claude/project-thread-kb3f9c
created: 2026-11-23
updated: 2026-11-23
archived_at: 2026-11-23
---

## Intent

An app renders "Log out" as a full-width sidebar row whose text starts at the same left edge as the line above it,
without descendant selectors into the package's markup: `LogoutButton` and `LogoutForm` let the app style the button
itself, not only the wrapping form.

## Context

Issue #1439 (labels `enhancement`, `pkg: auth`, `adoption`). Both components pass `className` to the `<form>`; the
button is `@softure-ai/ui`'s `Button` (`md`, `px-4`, content width, centred) with no way to reach it. The adopting
app works around it with `[&_button]:…` selectors on the form.

## Scope

- `LogoutForm` (`@softure-ai/auth/ui`) and `LogoutButton` (`@softure-ai/auth/next`) gain the button's look props:
  `size`, `fullWidth`, `iconLeft`, `unstyled`, and `classNames: { form, button }`. `className` keeps styling the form.
- Tests, README (a sidebar-row example), CHANGELOG. Release auth after the merge (patch or minor per the ranges).

## Constraints

- No change to any app repository; the CHANGELOG says what an app can drop.
- Backwards compatible: today's props keep their meaning.

## Notes

- frame skipped: the issue names the problem and two options; the owner asked to pick the best one.

## Done

- `LogoutForm` (`/ui`) and `LogoutButton` (`/next`) take `size`, `fullWidth`, `iconLeft`, `unstyled` and
  `classNames: { form, button }`, passed to `@softure-ai/ui`'s `Button`; `className` still styles the form.
- Tests pin each prop, the busy state under `unstyled`, and the forwarding from `LogoutButton`.
- README shows a sidebar footer row; CHANGELOG under `Unreleased`. Release auth after the merge.
