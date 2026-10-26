---
change_id: mailing-named-senders-798
title: "mailing: a sender per mail (issue #798)"
status: archived
roadmap_item: null
issue: 798
branch: claude/project-thread-q5n7qh
created: 2026-10-26
updated: 2026-10-26
archived_at: 2026-10-26
---

## Intent

Close [issue #798](https://github.com/SOFTURE/AI/issues/798): `mailing({ from })` sets one sender for every mail of
an app, so operator alerts and mail to the app's users or clients share one `From`. Add named extra senders in the
options (`mailing({ from, senders })`), let a mail pick one by name (`OutgoingMail.sender`), carry the name through
`deliverOnce` and queued deliveries, show the resolved `From` in `previewMail`, and make `softure-mail dns` check
the domain of every configured sender.

## Context

Labels: `enhancement`, `pkg: mailing`. No version bump in this change: the coordinator releases mailing in the
next combined release (a patch, since a minor breaks the `^0.2.0` ranges of the packages that depend on mailing).

## Constraints

- A mail never carries a free sender address: only a name of a configured sender. A request can never choose it.
- An unknown sender name is `mailing.invalid_input` with `fields=sender`; nothing is sent.
- Mail without `sender` behaves exactly as before (`from`).
- Nothing of a mail reaches a log; the sender name is configuration, the log keeps only field names.

## Notes

- Framing: skipped. The issue names the problem and the API.
