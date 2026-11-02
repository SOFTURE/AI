---
change_id: mcp-access-confirmed-calls-953
verdict: approved
---

# Implementation review

Reviewed the diff of 89923f0 and 6704ddb against plan.md.

- Ask 1: the first call answers `{ needsConfirmation, estimate, confirmation, expiresAt, message }` and runs nothing
  (test "answers the estimate and a token on the first call"); the sentence comes from `confirmation.ask`.
- Ask 2: each refusal has its own code and test: invalid (free text, empty, a tampered total under the old
  signature, another secret, a wrong signature, an over-long value), other tool, other account and other access
  token, expired at the exact expiry (and accepted a second before), changed arguments (the token stays valid for
  the agreed ones), changed estimate, used. Two parallel second calls run the handler once (the insert with
  `ON CONFLICT DO NOTHING` is the single gate).
- Ask 3: a zero total runs at once with `runWithoutConfirmationWhen`, recorded as `confirmed: false`.
- Ask 4: `confirmed` in the record (false, false, true for estimate, refusal, confirmed call); `argumentNames`
  without `confirmation`; over MCP a strict server lists `confirmation` as optional and accepts it, with a number
  sent as text still matching the agreed arguments.
- Safety: the signature is compared with `timingSafeEqual` after a shape check, before any payload field is read;
  a missing or short secret fails the call with one log line, never runs it unasked.
- Prune and health: `pruneMcpAccess` counts `usedConfirmations` (CLI line and the existing exact assertions updated);
  the health check reads the new table.
- Gates: typecheck, ESLint and the language gate green in the pre-commit hook; mcp-access tests 410 of 410 locally.

Verdict: approved.
