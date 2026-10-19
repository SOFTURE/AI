---
change_id: waitlist-form-look-593
title: "waitlist: WaitlistForm's email field, consent boxes and submit button take the app's look and ids (issue #593)"
status: archived
roadmap_item: null
issue: 593
branch: claude/project-thread-q06mw7
created: 2026-10-19
updated: 2026-10-19
archived_at: 2026-10-19
---

## Intent

Close [issue #593](https://github.com/SOFTURE/AI/issues/593). An adopting app that swapped its own waitlist form for
`WaitlistForm` (waitlist 0.4.0) cannot match its previous form: the email field, the consent checkboxes and the submit
button are rendered from `@softure-ai/ui` with fixed props. Missing: the button's width, variant and class; a
description under a consent box and the boxes' look; the email field's label class and placeholder; stable ids for the
email field and the consent boxes.

## Context

Labels: `enhancement`, `pkg: waitlist`, `adoption`. waitlist 0.4.0 is the latest on npm and on master; it needs ui
`^0.3.0`, whose `TextField` (`id`, `placeholder`, `classNames`), `Checkbox` (`id`, `description`, `classNames`) and
`Button` (`variant`, `fullWidth`, `classNames`) already cover everything. Auth solved the same gap in #588
(`fieldClassNames`, `fieldHintAs`, `fieldHintProps`, `consentProps`, `submitVariant`, `classNames.submit`); the names
here follow it. Releases are batched by the coordinator: no version bump, the CHANGELOG gets `## Unreleased`.

## Acceptance

- `WaitlistForm` takes `submitVariant` and `submitFullWidth` (default `true`, today's look), and a `submit` slot in
  `classNames` for the button's class.
- `WaitlistFormScope` takes `description` (rendered under the box, tied with `aria-describedby`) and `inputId` (the
  box's id); `scopeClassNames` gives every box its look.
- `WaitlistForm` takes `emailProps` (`id`, `placeholder`) and `fieldClassNames`, `fieldHintAs`, `fieldHintProps` for
  the email field.
- `<Waitlist />` passes the same look props through, with `consentDescriptions` and `consentIds` per scope id.
- Existing calls render the same markup.

## Notes

- Framing: skipped. The issue states the problem, the proposal and the acceptance.

## Decisions (auto)

- The placeholder is a prop (`emailProps.placeholder`), not a new `form.emailPlaceholder` message: the package has no
  placeholder of its own to ship, and an empty default message would read as copy. It is the app's copy, passed like
  the scope labels.
- Names follow auth #588 (`fieldClassNames`, `fieldHintAs`, `fieldHintProps`, `submitVariant`, `classNames.submit`) so
  an app styles both packages' forms the same way. The issue's alternative slots (`email`, `scope`, `submit` as
  objects) are not taken.
- `submitFullWidth` is a new name (auth always renders a full-width button); its default `true` keeps today's look.
- `<Waitlist />` gets the look props too (they are plain data, so they cross from a server component), unlike #588's
  ready pages: `Waitlist` is the documented one-line form and already passes `classNames` through.
