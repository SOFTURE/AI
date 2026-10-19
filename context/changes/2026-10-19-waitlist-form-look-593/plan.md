---
change_id: waitlist-form-look-593
status: in_progress
---

# Plan: the app's look and ids in WaitlistForm (issue #593)

Input: change.md, research.md. Complexity: small (one form, the server wrapper, tests, docs).

## Phase 1: form props (TDD)

Files: `modules/waitlist/src/ui/waitlist-form.tsx`, `src/ui/index.ts`, `src/next/waitlist.tsx`,
`tests/waitlist-form.test.tsx`, `tests/next-join.test.tsx` (or the test that renders `Waitlist`).

1. Tests first:
   - default: the button carries ui's full-width class; `submitFullWidth={false}` drops it; `submitVariant` and
     `classNames.submit` reach the button;
   - `emailProps={{ id: "field-email", placeholder: "you@example.com" }}` gives `#field-email` with the placeholder;
     `fieldClassNames={{ label: "app-label" }}` reaches the email label;
   - a scope with `description` and `inputId` renders the box at that id with the description tied by
     `aria-describedby`; `scopeClassNames={{ label: "app-check" }}` reaches every box;
   - `<Waitlist consentDescriptions consentIds submitFullWidth={false} />` passes them to the form.
2. Implement: `submit` slot (default ""), `submitVariant`, `submitFullWidth`, `emailProps` (`WaitlistEmailProps`,
   exported), `fieldClassNames`, `fieldHintAs`, `fieldHintProps`, `scopeClassNames`, scope `description`/`inputId`;
   `Waitlist` passes them through and builds scope `description`/`inputId` from the maps.

## Phase 2: docs

`modules/waitlist/README.md` (section 4 own form, section 8 Appearance), `CHANGELOG.md` `## Unreleased` with the
migration for an app that kept its own form for its look.

## Progress

- [ ] Phase 1: form props (TDD)
- [ ] Phase 2: docs
