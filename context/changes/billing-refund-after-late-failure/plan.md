# Plan: billing-refund-after-late-failure

Input: change.md, research.md. Complexity: low (one migration, one refactor of two functions, tests).

## Goal

- A charge state newer than the one billing applied, reporting no more than billing counts, is kept.
- The late failure that explains it gives back the failed refund and then applies the kept state:
  the new refund takes back its share once (partial, full, and equal-total cases).
- A kept state waits through several late failures until its corrected total is above the recorded one.
- FU-30's behaviour holds: stale and repeated deliveries change nothing; an uncounted failure gives back nothing.

**Out of scope:** reading the charge from Stripe; a refund that arrives before its checkout (README §12).

## Approach

**Starting point:** a lower or equal newer total is `duplicate` and forgotten (research F1).

**Chosen:** keep the newest unapplied state on the payment and re-apply it after each failure
(research F3, F4), through one function shared by `refundPayment` and `failRefund` (F5).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where the state lives | `pending_refunded_amount bigint`, `pending_refunds_seen_at timestamptz` on `billing.payments`, CHECK both NULL or both set, amount >= 0 | one row per payment, read under its lock | F3, F6 |
| What is stored | the raw reported total (before correction) and the event's `created` | later failures correct it when it is read | F3 |
| When kept | not applied, and newer than `refunds_seen_at` and than a kept one | only a newer state can hold an uncounted refund | F4 |
| When cleared | a state applied at or after the kept one's time | the applied one includes it | F4 |
| Applying in `failRefund` | after the restore, re-read the row, run `applyChargeState` with the kept state; outcome stays `refund_failed` with the final entitlement | one code path, same locks | F5 |
| Export | not exported, like `refunds_seen_at` | bookkeeping, Stripe holds the state | F6 |

**Critical details:** the comparison and the correction happen inside the locked transaction;
`refunds_seen_at` after applying a kept state is the later of the two times, so the failure checks
that follow date against it.

## Phase 1: A newer charge state waits for the failure that explains it

**Discipline:** TDD. **Files:** `migrations/0009_record_pending_charge_states.sql`, `src/schema.ts`,
`src/server/payments.ts`, `tests/failed-refunds.test.ts`, `README.md`,
`examples/next-app/e2e/migrations.spec.ts`.

1. Tests first (`tests/failed-refunds.test.ts`, PGlite):
   - a partial refund, a newer lower state (a new refund after the first failed), then the late
     failure: the new refund's days are taken back once (fails on `master`: nothing taken back);
   - the same after a full refund (payment `refunded`), and with a new refund equal to the first;
   - two late failures: the kept state applies only after the second;
   - a newer applied state clears a kept one; repeated deliveries and a repeated failure change nothing;
   - through signed webhook fixtures: `charge.refunded` (partial), `charge.refunded` newer and lower,
     then `refund.failed` dated before it.
2. Migration `0009` (header with rollback), schema columns, `payments.ts` (`applyChargeState`,
   `keepNewerChargeState`, `refundPayment`, `failRefund`, header comments).
3. README: the §4 `charge.refunded` row (a newer lower state is kept, answer `duplicate`), refund-failure paragraph, column table, migrations list, §12 limitation replaced by a note that the kept refund's days are counted at the failure's delivery; e2e
   ledger line `billing 9 record_pending_charge_states (applied)`.
4. Gates: `npm run typecheck`, `npm run lint`, `npm test` (with a local Postgres 16), `npm run build`.

## Risks and rollback

- A kept state that no failure ever explains stays on the row; it changes nothing (its corrected
  total never exceeds what billing counts unless a counted failure lowers that).
- Rollback: the migration's header (drop the CHECK and both columns, delete ledger row 9) and a
  revert of the commit; the old code ignores the columns.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: A newer charge state waits for the failure that explains it

#### Automated
- [ ] 1.1 A new refund reported before a late failure is taken back once the failure arrives
- [ ] 1.2 The same after a full refund and with an equal total
- [ ] 1.3 A kept state waits through several failures, and a newer applied state clears it
- [ ] 1.4 Signed webhook deliveries in that order
- [ ] 1.5 Gates green (typecheck, lint, test, build)
