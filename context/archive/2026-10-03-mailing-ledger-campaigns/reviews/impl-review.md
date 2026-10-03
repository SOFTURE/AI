# Implementation review: mailing-ledger-campaigns

Reviewed: branch `claude/en-3-mailing-ledger-campaigns-1u6kkr` against `master` (author's review,
`--auto`). Verdict: approve. Findings: 0 critical, 1 warning (fixed), 1 suggestion.

## Checks

- Claim is one conditional upsert; tests cover a new row, a released row, a fresh claim, a stale
  claim, two racing senders and a fenced outcome after a take-over.
- A campaign to N recipients gives N outcomes; a re-run sends nothing; changed content is refused;
  suppressed recipients are rejected without a send (tests on PGlite).
- Every invariant that can be a constraint is one: status/outcome columns, campaign scope, kebab ids,
  campaigns never transactional, recipient keys instead of addresses.
- No address or database URL reaches output or logs; driver messages are unwrapped from Drizzle's
  query text.
- English only; README, migration rollback comment, `module.json` and lockfile `bin` updated.

## Findings

### W1 [WARNING] The campaign pause counted refusals that never reached the provider
**Decision:** Fixed - only `sent`, `retry-later`, `mailing.rejected` and `mailing.unavailable` pause.

### S1 [SUGGESTION] Batch the suppression lookups of a dry run
**Decision:** Defer - one query per recipient is fine for an operator's dry run; revisit with
lists in the tens of thousands.
