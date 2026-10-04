# Plan: billing-stale-handover-claim

Input: change.md, research.md. Complexity: low (one migration, three query functions, one call site, tests).

## Goal

- A hand-over claimed more than a minute ago and never answered is claimed again by the next ask,
  which hands the request over (the owner hears of it).
- A hand-over that answered `Ok` is recorded as done and never repeated, however late the ask.
- Two asks at once still hand over once; a failed hand-over (`Err` or throw) is still released for
  the next ask.

**Out of scope:** FU-35; mailing the owner from expiry or a scheduler; the Stripe path (no hand-over).

## Approach

**Starting point:** one column, `handed_over_at`, is both the claim and the result (research F1).

**Chosen:** split it (research F2, F3): migration `0008_record_request_handover_claims.sql` adds
`handover_claimed_at timestamptz`; `handed_over_at` now means "the hand-over answered `Ok`".

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Claim | conditional `UPDATE ... SET handover_claimed_at = now WHERE id AND status = 'open' AND handed_over_at IS NULL AND (handover_claimed_at IS NULL OR handover_claimed_at <= now - 1 min)` | one statement, so two asks at once still claim once | F3 |
| Bound | `HANDOVER_CLAIM_TIMEOUT_MS = 60_000`, a module constant, not an option | a mail call takes seconds; no deployer has asked for a knob | F5 |
| Success | `confirmHandOver(ctx, requestId)`: `SET handed_over_at = now, handover_claimed_at = NULL WHERE id AND handed_over_at IS NULL` | the mail went out, whoever holds the claim now; the first confirm wins | F6 |
| Failure | `releaseHandOver` clears `handover_claimed_at` only where it equals its own claim | a later claim (after the timeout) is never cleared by an earlier ask | FU-27 |
| Older rows | `handed_over_at` kept as is (counts as handed over) | cannot tell a stale claim from a success before `0008` | F7 |

**Critical details:** the cutoff is computed from `ctx.clock` like the claim time, so tests drive it
with the test clock. A provider answer that contradicts `handsOverRequests` still throws; its claim
now expires after the minute instead of staying forever.

## Phase 1: Claims that expire, hand-overs that are confirmed

**Discipline:** TDD. **Files:** `migrations/0008_record_request_handover_claims.sql`,
`src/schema.ts`, `src/server/requests.ts`, `src/server/plans.ts`, `tests/payments.test.ts`,
`README.md`, `examples/next-app/e2e/migrations.spec.ts`.

1. Tests first (`tests/payments.test.ts`, PGlite):
   - a hand-over left without an answer (the provider's promise never settles, as when the process
     dies) is not repeated by an ask 59 seconds later and is handed over by an ask a minute later;
     asks after that hand over nothing;
   - a hand-over that answered `Ok` is not repeated by an ask a day later (fails if the claim alone
     expired);
   - a first hand-over that answers `Ok` after a second ask re-claimed it: the request is handed over
     and a third ask hands over nothing.
   The first fails on `master` (one hand-over only).
2. Migration `0008` (header with rollback), `schema.ts` column and header, `requests.ts`
   (`claimHandOver`, `confirmHandOver`, `releaseHandOver`, header comment), `startPayment` calls
   `confirmHandOver` after an `Ok` `requested`.
3. README: the invoice-requests paragraph, the column table, the migrations list, §12 limitation
   (replaced by the at-least-once note); e2e ledger line `billing 8 record_request_handover_claims (applied)`.
4. Gates: `npm run typecheck`, `npm run lint`, `npm test` (with `SOFTURE_TEST_POSTGRES_URL` on a
   local Postgres 16), `npm run build`.

## Risks and rollback

- After a crash the owner may get the mail twice (at least once, research F6); documented.
- Rollback: the migration's header (`DROP COLUMN handover_claimed_at`, delete ledger row 8) and a
  revert of the commit; `handed_over_at` keeps its values, which the old code reads as claims.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Claims that expire, hand-overs that are confirmed

#### Automated
- [ ] 1.1 A claim left without an answer is handed over by an ask a minute later
- [ ] 1.2 A confirmed hand-over is never repeated
- [ ] 1.3 A late `Ok` after a re-claim leaves the request handed over once more, not again
- [ ] 1.4 Gates green (typecheck, lint, test, build)
