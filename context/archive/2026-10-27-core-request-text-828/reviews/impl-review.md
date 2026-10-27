---
change_id: core-request-text-828
verdict: approved
---

# Implementation review

Reviewed the diff from 1449291 against plan.md.

- Every ask of issue #828 is covered: `requestText` with `url`, `fetch`, `headers`, `timeoutMs`, `clock`, `maxBytes`,
  `notFoundAsNull`, redirect following with the final URL (opt-in `followRedirects`), and the shared failure codes with
  `retryAfterSeconds`.
- No copy: the `maxBytes` check, the `Content-Length` pre-check and the chunked read moved out of `requestBytes` into
  `getMaxBytes` and `readCappedBody`, used by both calls; status mapping and `Retry-After` stay in `http-json.ts`. The
  helpers are exported from `http-bytes.ts` for the sibling module only, not from the package index. The `requestBytes`
  tests pass unchanged.
- Types: overloads keep `null` out of the value unless `notFoundAsNull: true` is passed literally; a boolean variable
  gets `HttpTextAnswer | null`.
- Safety: redirects are refused by default, so a credential header follows one only when the caller asks; no caught
  error's text, URL or body reaches a failure (tests assert the secret in the URL never appears).
- Decoding: the `charset` of `Content-Type` is honoured, an unknown label falls back to UTF-8, a BOM is stripped.
- Gates: typecheck, lint and the language gate green; core 562 tests pass.

Verdict: approved, no changes.
