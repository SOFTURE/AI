---
change_id: mailing-attachments-655
title: "mailing: attachments on sendMail (issue #655)"
status: in_progress
roadmap_item: null
issue: 655
branch: claude/project-thread-auuo2c
created: 2026-10-22
updated: 2026-10-22
---

## Intent

Close [issue #655](https://github.com/SOFTURE/AI/issues/655): `sendMail` carries a text and HTML body only, so an
app that forwards a document, mails an invoice or a report, or an export the user asked for, has to bypass
`@softure-ai/mailing` and lose its log, preview and delivery ledger. Add attachments to `sendMail` and to the
provider contract, map them in the Resend adapter, validate count, total size, filename and content type before
anything leaves the process, keep the content out of every log, show attachments in the dry run, and settle how
queued deliveries (jobs) carry them.

## Context

Labels: `enhancement`, `pkg: mailing`. No release in this change: the coordinator releases mailing in the next
combined release.

## Constraints

- Nothing of a mail reaches a log or a result; attachment content never does.
- Existing mail without attachments behaves exactly as before.
- A provider that cannot carry attachments must not drop them silently.
- The job payload of a queued delivery never holds the mail, attachments included.

## Notes

- Framing: skipped. The issue names the problem and the API.
