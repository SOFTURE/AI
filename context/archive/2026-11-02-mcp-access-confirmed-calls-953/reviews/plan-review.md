---
change_id: mcp-access-confirmed-calls-953
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (c9380e5).

- Ask 1 (`withConfirmation`, estimate-only first call, fixed sentence): Phase 1; the sentence comes from the
  dictionary, so an app can override it like every other text.
- Ask 2 (HMAC bound to tool, canonical arguments, account and access token, total, expiry; single use by hash;
  distinct `input.confirmation_*` codes): Phase 1; the check order puts the signature first, so no unsigned field is
  trusted, and the single-use insert last, so a refused call does not burn a valid token.
- Ask 3 (`runWithoutConfirmationWhen`): Phase 1, recorded as `confirmed: false`.
- Ask 4 (`confirmed` in the record; the field in the strict schema): Phase 1, with `confirmationInput`.
- Risk: a new migration (0004) while #961 may add one in the same package; whoever merges second renumbers. Noted.
- Risk: apps must set `MCP_CONFIRMATION_SECRET` before using the wrapper; a missing secret fails loudly, never
  silently skips the confirmation. Accepted.
- Risk: `ToolCallRecord` gains a field; hooks that read it are unaffected, a hook that builds records in tests
  needs the field. Called out in the changelog.

Verdict: approved, no changes.
