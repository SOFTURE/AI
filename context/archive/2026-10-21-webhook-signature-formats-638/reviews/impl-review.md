---
change_id: webhook-signature-formats-638
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md, the issue and the package conventions.

- Verifier: the MAC is decoded strictly (hex of exactly one digest in either case; standard base64, padding only
  when it completes the last group, no base64url) and compared as bytes in constant time. Prefix is matched exactly
  after trimming; a header with an unexpected prefix fails. Empty secrets (also inside a list) fail closed. Unknown
  algorithm or encoding throws (configuration bug), as `verifySignedRequest` throws on a bad tolerance. Test vectors
  come from `node:crypto`. The entry `@softure-ai/security/signed-request` still imports only `@softure-ai/core`;
  `atob`/`btoa` and Web Crypto exist in Node 22 and in Workers.
- Ledger: one `INSERT … ON CONFLICT DO NOTHING RETURNING`, so parallel retries give exactly one `true`; tested inside
  a rolled-back transaction. The table checks mirror the code checks (source pattern, id length, no control
  characters). Migration is additive with a rollback comment; manifest, `module.json` and the example app's
  migration list follow.
- Pruning: `received_at < now - retentionDays`, a row exactly at the cutoff stays (tested); daily job added to the
  existing schedule map, so apps that spread `securityJobSchedules` get it without changes.
- Errors: an invalid delivery id from a header is a value (`security.delivery_id_invalid`, English copy), a
  malformed source throws. No error is swallowed.
- Docs: README section with presets, option, tables, copy, GDPR, jobs and limitations; CHANGELOG `## Unreleased`
  with a migration note. No version bump: the coordinator releases.

Findings: none blocking. Verdict: approved.
