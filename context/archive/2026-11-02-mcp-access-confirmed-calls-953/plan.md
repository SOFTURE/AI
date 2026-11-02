---
change_id: mcp-access-confirmed-calls-953
status: archived
---

# Plan: confirmed tool calls (issue #953)

Input: change.md, research.md (option 2). Complexity: medium (one package, one migration).

## Phase 1: token, table, wrapper (TDD)

Files: `modules/mcp-access/src/server/confirmation.ts` (new), `src/server/tools.ts`, `src/server/index.ts`,
`src/messages/en.ts`, `src/schema.ts`, `migrations/0004_create_used_confirmations.sql`, `src/index.ts` and
`module.json` (table, env), `src/server/prune.ts`, `src/server/health.ts`, `tests/confirmation-953.test.ts`.

- `withConfirmation(handler, { ctx, identity, tool, estimate, ttlSeconds = 900, runWithoutConfirmationWhen, secret,
  hints, onToolCall, caller })` returns the tool callback. `estimate(args)` returns an object with a numeric
  `total` (anything else is passed through to the assistant).
- Without `confirmation`: estimate only; when `runWithoutConfirmationWhen(estimate)` is true the handler runs at
  once (`confirmed: false`); else the answer is `{ needsConfirmation: true, estimate, confirmation, expiresAt,
  message }`, `message` being the fixed sentence `confirmation.ask` of the dictionary.
- Token: `<base64url payload>.<base64url HMAC-SHA256>`; payload = version, tool, sha256 of the canonical JSON of
  the arguments without `confirmation`, sha256 of user id and token id, total, expiry (epoch seconds), random
  nonce. Signed with a domain prefix. Checked in this order, each with its code: shape and signature
  (`input.confirmation_invalid`), tool (`input.confirmation_other_tool`), account (`input.confirmation_other_account`),
  expiry (`input.confirmation_expired`), arguments (`input.confirmation_arguments_changed`), the estimate run again
  and its total (`input.confirmation_estimate_changed`), single use (`input.confirmation_used`). Only then the
  handler runs (`confirmed: true`).
- Secret: `secret` option, else `MCP_CONFIRMATION_SECRET`, read on every call; under 32 characters counts as
  missing and the call fails as a bug with one log line naming the variable.
- `mcp.used_confirmations (token_hash text PRIMARY KEY, used_at, expires_at)`; consumed with
  `ON CONFLICT DO NOTHING RETURNING` right before the handler. `pruneMcpAccess` gains `usedConfirmations`
  (rows past `expires_at`); the health check reads the table.
- `ToolCallRecord.confirmed: boolean | null` (null for a tool without confirmation), set through
  `ToolErrorOptions.confirmed`; `argumentNames` leave `confirmation` out.
- `CONFIRMATION_FIELD` and `confirmationInput` (optional string, max 1024, described) for the tool's input schema.
- Tests: the full round trip; each refusal code; a reused token in parallel runs once; a zero total runs at once;
  the record's `confirmed`; a strict server lists and accepts `confirmation`; prune and health.

## Phase 2: docs

README ("Confirmed calls" under §4, §5 table, §6 variable, §10 hooks), `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- HMAC token as the issue proposes, with the bound fields' digests in the payload, so each mismatch gets its own
  code instead of one "invalid".
- The estimate runs again on the confirmed call and its total must match: otherwise binding the total checks
  nothing (a price that changed after the yes is refused).
- The token is consumed before the handler runs; a handler that fails afterwards needs a new estimate. Spending
  twice on one yes is worse than asking again.
- The used-token table holds no user id: the hash and two dates are not personal data, so the privacy contributor
  is unchanged.
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: token, table, wrapper (89923f0)
- [x] Phase 2: docs (6704ddb)
- [x] Implementation review
