# Research: billing-refund-manual-lifetime

Input: change.md. Sources: `modules/billing/src/server/{payments,grants,take-back}.ts`,
`modules/billing/README.md` §6, §12, `tests/grants.test.ts`.

## Answers to unknowns

**Can the grant history be read in the refund's transaction under the entitlement lock?** Yes.
`refundPayment` locks the account (key share), then the entitlement (`lockEntitlementRow`, FOR
UPDATE), then its payment row, and calls `takeBackGrant` in the same transaction (`ctx.db` is
`tx`). `hasActiveManualLifetime(tx, userId)` is a plain select on `billing.manual_grants` in that
transaction. Every writer of a manual grant takes the same entitlement lock first:
`grantPlanManually` (`grants.ts`, before its lifetime check and its insert) and `revokeManualGrant`
(before flipping its row). So a manual lifetime granted or revoked concurrently is either committed
before the refund reads it, or waits for the refund to commit and applies after: the decision cannot
see a half state. No new lock and no migration are needed.

**How does a manual revoke after a manual lifetime count?** A revoke sets the grant's `status` to
`revoked`; `hasActiveManualLifetime` counts only `status = 'active'` lifetime grants, so a revoked
one no longer keeps lifetime. That is symmetric with the revoke itself, which already ends a manual
lifetime unless another active manual lifetime or a paid lifetime payment keeps it (README §6,
`grants.ts`). The existing test "ends a manual lifetime, unless a paid lifetime or another manual one
still gives it" (`tests/grants.test.ts`) already walks this: both manual grants revoked, then the
paid lifetime refunded, leaves the trial; it must stay green.

## How the state arises

`grantPlanManually` refuses an account with lifetime (`billing.lifetime_active`) and `startPayment`
refuses one too, so a paid lifetime next to a manual one comes from a checkout started before the
admin's grant and paid after (the webhook records it regardless), or from a grant written before
the guard existed. Tests build it the first way: a manual lifetime grant, then `recordPayment` of a
lifetime.

## Partial refunds (FU-20)

`getTakeBackEvent` returns before asking `hasOtherLifetime` for a partial share of a lifetime
(a partial refund never ends a lifetime), so only a full refund reaches the new check. Nothing changes
for partial refunds.

## Recommendation

In `refundPayment`, ask `hasActiveManualLifetime(tx, userId) || hasPaidLifetimePayment(tx, userId,
payment.id)`, the same order `revokeManualGrant` uses. Update the doc comment, the payments module
header if it names the rule, README §6 (refund of a lifetime) and drop the §12 limitation.
