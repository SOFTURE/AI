---
change_id: mailing-attachments-655
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the package on master (623319f).

- Scope covers every ask of the issue: the field on `sendMail` and `ProviderMessage`, the Resend mapping, limits
  (count, total size under 40 MB on the wire, filename, content type), the log without content, the dry run, and a
  documented answer for queued sends.
- Safety: the `supportsAttachments` opt-in closes the silent-drop risk for custom providers; the log never gets
  content or filenames; the payload guard keeps bytes out of the jobs table.
- Compatibility: `attachments` is optional on `OutgoingMail`; `ProviderMessage.attachments` is a new required field,
  which only affects code that builds a `ProviderMessage` itself (tests, custom fakes); noted in the CHANGELOG.
  `readMailOutbox` keeps reading older lines.
- Tests: boundary cases at exactly the limits and one past; bytes compared exactly after the base64 round trip.
- Risk: `Uint8Array` from another realm or a Node `Buffer` must pass; check with `instanceof Uint8Array`
  (Buffer is a subclass) and accept that cross-realm arrays are out of scope.

Verdict: approved, no changes.
