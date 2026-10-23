---
change_id: connections-api-key-header-675
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the package on master (5398024).

- Scope covers every ask of the issue: the optional placement with a Bearer default, the helper sending it and
  replacing a caller's header of that name, `{ name, value }` for an app's own client, and the validation rules
  (token name, scheme only with `authorization`).
- Compatibility: additive; the provider schema was strict, so no existing config holds `header`; `getCredential`
  and `getAuthorizationHeader` keep their answers.
- Safety: the headers stay pairs, so no `Headers` constructor quotes a key outside `requestJson`'s try. A key value
  with a newline was already refused by `requestJson`'s own header building inside its try.
- Conflict risk with #676: both edit `request.ts`; this change touches only the header helper, so a merge is local.

Verdict: approved, no changes.
