---
change_id: mailing-attachments-655
verdict: approved
---

# Implementation review

Reviewed the diff of 700545c and 4c1b800 against plan.md and the issue.

- Every ask is covered: `attachments` on `OutgoingMail` and `ProviderMessage`, the Resend mapping (base64 with
  `content_type`, only the view's own bytes), count / total size / filename / content type checked before the
  provider is called, a log line with content types and sizes only, the dry run (`previewMail`,
  `formatMailPreview`), and queued deliveries by reference with a payload guard.
- Safety: a provider without `supportsAttachments` is never called with attachments; the log uses the content type
  essence, so a parameter such as `name="..."` cannot leak a filename; the fake provider copies the bytes, so a
  caller reusing its buffer does not change what was captured.
- Compatibility: mail without attachments produces the same `ProviderMessage` as before (no `attachments` key);
  older outbox lines still parse; the only changed existing test is the options default (new `attachments` key).
- Tests: 30 new cases in `tests/attachments.test.ts` (limits at and one past each bound, every filename rule, the
  allow-list, the log line, Resend body, outbox round trip, options) and 4 in `tests/jobs.test.ts`.
- Gates: typecheck, ESLint (zero warnings), the language gate and the mailing tests pass locally.
- Noted, not changed: a mail refused for `provider_without_attachments` through `deliverOnce` is closed as
  `rejected` (`invalid_input`), like any invalid mail; the fix is configuration, then a new scope.

Verdict: approved.
