# Plan: billing-refund-manual-lifetime

Input: change.md, research.md. Complexity: small.

## Goal

A full refund of a paid lifetime payment keeps lifetime access while an active manual lifetime grant
of the account exists; with the manual grant revoked (or none), it ends lifetime as today.

**Out of scope:** FU-22 (the `grant-plan` script) and later lane C items; partial refunds (they
never end a lifetime); any schema change.

## Approach

**Starting point:** `refundPayment` passes `hasOtherLifetime: () => hasPaidLifetimePayment(tx,
userId, payment.id)` (`src/server/payments.ts`).

**Chosen:** add `hasActiveManualLifetime(tx, userId)` to that callback, read under the locks
`refundPayment` already holds. Rejected: recording a synthetic payment row for manual grants (a
migration and a second source of truth); reading `is_lifetime` from the entitlement (it is the state
being decided, not what pays for it).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| What counts | active manual lifetime grants or another paid lifetime payment | same rule as `revokeManualGrant` | research |
| Locks | none new | manual grant writers queue on the entitlement lock already held | research |
| Revoked manual lifetime | does not count | `status = 'active'` only | research |

## Steps

1. `src/server/payments.ts`: import `hasActiveManualLifetime`; `hasOtherLifetime: async () =>
   (await hasActiveManualLifetime(tx, userId)) || (await hasPaidLifetimePayment(tx, userId,
   payment.id))`; doc comment of `refundPayment` says "unless another lifetime payment or an active
   manual lifetime still gives it".
2. `tests/grants.test.ts` (it has both manual grants and refunds): a test "keeps lifetime when a
   paid lifetime is refunded while a manual lifetime gives it" (manual lifetime, then a recorded
   lifetime payment, refund in full: status paid, `endsAt: null`, row `is_lifetime: true`); a test
   that the refund ends lifetime once that manual grant was revoked (revoke keeps lifetime because
   of the payment, then the refund leaves the trial). Run the test first without step 1 to see the
   first one fail.
3. `modules/billing/README.md`: §6 refund of a lifetime names active manual lifetime grants; §12
   drops the FU-21 limitation (keep "A dated manual grant keeps its length." if still true, as its
   own line).
4. Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Progress

- [x] 1. refundPayment counts active manual lifetime grants
- [x] 2. tests
- [x] 3. README
- [x] 4. gates
