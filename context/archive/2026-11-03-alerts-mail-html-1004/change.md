---
change_id: alerts-mail-html-1004
title: "alerts: mailChannel sends an HTML part next to the text (issue #1004)"
status: archived
roadmap_item: null
issue: 1004
branch: claude/project-thread-b5rov2
created: 2026-11-03
updated: 2026-11-03
archived_at: 2026-11-03
---

## Intent

Close [issue #1004](https://github.com/SOFTURE/AI/issues/1004). `mailChannel` of `@softure-ai/alerts` 0.1.1 sends
only `{ subject, text }`, so an alert with list-like details reads as one unwrapped block on a phone. `sendMail`
already takes an optional `html`. The mail channel gets an HTML part with a default layout (single column, at most
600 px, inline styles, severity badge, title, details, repeats line, link button, every value escaped), an `html`
option to replace or drop it, a small `details` line convention (`- ` list items with indented sub-lines) the layout
renders as a list, and exports of the idempotency key and the mailing error mapping so an app's own channel does not
copy them.

## Context

Labels: `enhancement`, `pkg: alerts`. No release in this change: the coordinator releases in the next combined
release.

## Constraints

- Owns `modules/alerts/` only.
- The text part and every other channel stay as they are.
- A delivery built by hand (an app's tests of its own channel) stays a valid `AlertDelivery`.
- English only; copy keeps coming from the alerts message dictionary.

## Notes

- Framing: skipped. The issue names the problem and the API.
