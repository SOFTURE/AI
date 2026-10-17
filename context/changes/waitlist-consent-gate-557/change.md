---
change_id: waitlist-consent-gate-557
title: "waitlist: a missing required consent is refused before the address is read (issue #557)"
status: in_progress
roadmap_item: null
issue: 557
branch: claude/project-thread-juqf2n
created: 2026-10-17
updated: 2026-10-17
---

## Intent

Close [issue #557](https://github.com/SOFTURE/AI/issues/557): an adopting app with a required marketing consent
keeps its own action because `joinWaitlistAction` must refuse a form without that consent before the email is
validated, looked up or written, and still count the refused attempt against the client's rate limit.

## Context

Labels: `enhancement`, `pkg: waitlist`, `adoption`. waitlist 0.3.0 is the latest on npm and on master. Releases are
batched by the coordinator: no version bump here, the CHANGELOG gets `## Unreleased`.

## Constraints

- Apps without a required scope behave as today.
- No new option when the existing configuration already expresses the requirement.

## Notes

- Framing: skipped. The issue states the problem, the proposal and the acceptance.

## Decisions (auto)

- No `requiredConsent` option: `waitlist({ scopes: [{ id, required: true, ... }] })` already declares a required
  consent, `WaitlistForm` already renders it as a required checkbox with a `ReactNode` label (`consentLabels` or
  `WaitlistFormScope.label`), and `joinWaitlist` already refuses it with `waitlist.consent_required` after spending
  one client attempt and before any lookup or write. A second way to say the same thing would only add drift.
- The one real gap is order: the address is validated before the scopes, so a form with a missing consent and a
  malformed address answers `waitlist.email_invalid`. The form check (`checkScopes`) moves in front of the address
  validation, so a missing consent is answered without the address being read.
