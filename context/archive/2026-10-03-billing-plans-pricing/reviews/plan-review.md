# Plan review: billing-plans-pricing

Written after the fact by FU-12 (`billing-retro-reviews`, 2026-10-04): MO-2 skipped research and its
plan review. The plan is reviewed as written, and every finding is checked against the code on
`master` today. Snapshot: b6c92c4 (master, 2026-10-04), after MO-3, FU-11 and FU-9. Research
written after the fact: [`../research.md`](../research.md).

Reviewed: plan.md @ 2026-10-04. Mode: deep (retro). Verdict: ready after fixes (would have been).
Findings: 0 critical, 3 warning, 5 suggestion.
Grounding: 37/37 paths, symbols and commands named in plan.md and change.md exist today. Two plan
claims are stale: "Manual requests … not stored" (stored since FU-9, `modules/billing/src/server/requests.ts`)
and "Price history: no table" (`billing.payments` since MO-3, `billing.manual_grants` since FU-9).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: plans, tiles, payment page, manual adapter, admin grant, e2e |
| Slicing | PASS |
| Verifiability | PASS |
| Data and migrations | PASS (MO-2 added no migration) |
| Tests | WARN (W2, W3) |
| Security | PASS: session or role checked before the form is read (`src/next/actions.ts:44,66-67`); no bound ids; bucket counted first; S2 |
| Lean | PASS |
| Fit | WARN (W1): the provider contract carries the amount in `Intl`'s minor unit |
| Cost and defaults | WARN (S1) |
| Scope | PASS |
| Reuse | PASS |
| Lessons | PASS (none applied) |
| Progress format | PASS |

## Findings

### W1 [WARNING] "Minor units" are `Intl`'s, not necessarily the provider's
**Effort:** medium. **Lens:** Fit. **Where:** plan "Multi-currency" row · `src/price.ts:25-26` · `src/stripe.ts:53`
**Problem:** The plan settles on minor units because "providers (Stripe `unit_amount`) take minor
units". For most currencies `Intl`'s digits and Stripe's units agree, but Stripe's currency guide
lists special cases: ISK and UGX are shown without decimals yet sent ×100, and HUF and TWD amounts
must be divisible by 100. `stripe()` sends `plan.price.amount` unchanged, so an ISK 1,500 plan
would be charged ISK 15. (The rule is the reviewer's reading of Stripe's guide; the guide could not
be fetched from this session, so the item starts by confirming it.)
**Fix:** The Stripe adapter refuses or scales special-case currencies, checked when the config loads;
a test per case, and a 3-decimal formatting test (KWD).
**Still applies:** yes.
**Decision:** Defer - FU-25 (`billing-stripe-currency-units`).

### W2 [WARNING] No test calls the actions as an anonymous or non-admin user
**Effort:** low. **Lens:** Tests. **Where:** plan Phase 1 tests · `src/next/actions.ts:44,77,120,162`
**Problem:** The checks are right today, but no unit test calls `startPaymentAction`,
`grantPlanAction` or FU-9's request and revoke actions without a session or without `adminRole`;
only the admin page's guard has an e2e (`examples/next-app/e2e/billing-pricing.spec.ts:156`). A
regression that drops a check passes CI.
**Fix:** Unit tests per action with a mocked session: anonymous, member, admin.
**Still applies:** yes.
**Decision:** Defer - FU-26 (`billing-guard-race-tests`).

### W3 [WARNING] Concurrent grants are tested on one connection
**Effort:** medium. **Lens:** Tests. **Where:** plan "Concurrent grants" row · `tests/payments.test.ts:50` · `src/server/grants.ts:49-52`
**Problem:** Impl review #1 already said the PGlite test cannot fail and checked the lock by hand
with two psql sessions. Nothing in CI guards it.
**Fix:** A two-connection Postgres test, shared with MO-1's first-insert race.
**Still applies:** partially (documented, untested).
**Decision:** Defer - FU-26 (`billing-guard-race-tests`).

### S1 [SUGGESTION] The owner is told before the request is stored, and again on each refresh
**Effort:** low. **Lens:** Cost and defaults. **Where:** plan "Manual requests" row · `src/server/plans.ts:135-136`
**Problem:** `onRequest` (the example mails the owner) runs before `recordPaymentRequest`; a failed
store leaves the mail sent and the buyer an error, so a retry mails again. A request that only
refreshes an open one mails again too (up to the bucket's 5 per hour).
**Fix:** Store first, hand over after; skip the hand-over when an open request was only refreshed,
or say so in it.
**Still applies:** yes (MO-2 stored nothing; FU-9 added the store after the hand-over).
**Decision:** Defer - FU-27 (`billing-invoice-request-hygiene`).

### S2 [SUGGESTION] Invoice fields accept control characters
**Effort:** low. **Lens:** Security. **Where:** `src/server/plans.ts:91-101` · `src/fields.ts:13-17`
**Problem:** A name with a newline can add lines that look like the mail's own (e.g. a fake
"Plan:" line) to the owner's invoice-request mail (`examples/next-app/messages/en.ts:57`). The
subject carries only the email and plan, so there is no header injection. The parser is
hand-written, not a zod schema at the boundary (AGENTS.md).
**Fix:** A zod schema that refuses C0 control characters (newlines allowed only in the address).
**Still applies:** yes.
**Decision:** Defer - FU-27.

### S3 [SUGGESTION] One error text for "missing" and "too long"
**Effort:** low. **Lens:** Verifiability. **Where:** `src/messages/en.ts:109`, `src/messages/pl.ts:111`
**Problem:** "Fill in this field…" is shown for a tax ID over 32 characters, which is optional.
**Fix:** Separate `required` and `too_long` codes and texts.
**Still applies:** yes.
**Decision:** Defer - FU-27.

### S4 [SUGGESTION] Open requests keep invoice details without a limit; manual grants keep no price
**Effort:** medium. **Lens:** Data. **Where:** plan "Price history" row · `migrations/0004_create_requests_and_grants.sql:24,31-56` · `modules/billing/README.md:96`
**Problem:** Since FU-9, details are cleared when a request closes, but a request nobody closes keeps
name, tax id and address forever. The plan's "a payment record (with the price paid) belongs to the
provider" has no counterpart for `manual()`: a manual grant records no amount or currency, so a
price change leaves no trace of what was invoiced.
**Fix:** Close requests older than a configurable age (dismissed, details cleared); store
`amount` and `currency` on the request and the manual grant.
**Still applies:** yes (partially: closed requests are cleared since FU-9).
**Decision:** Defer - FU-27.

### S5 [SUGGESTION] `adminRole` is not checked against auth's roles
**Effort:** low. **Lens:** Security. **Where:** `src/options.ts:81`
**Problem:** A typo fails closed (nobody is admin, `modules/auth/src/next/current-user.ts:69-72`), safe but silent.
**Fix:** A setup assertion next to `assertPaymentSetup`.
**Still applies:** yes.
**Decision:** Defer - FU-26.

## Findings later changes closed

- **A lifetime account could request an invoice, and a dated grant to it was a silent no-op**
  (WARNING; impl review #4). Fixed by FU-9: `billing.lifetime_active` from `startPayment`
  (`plans.ts:127`) and the grant (`grants.ts:54`); the page hides the form.
- **Requests not stored, no revoke, no history** (plan "Manual requests", change.md out of scope).
  Fixed by FU-9 (`billing.payment_requests`, `billing.manual_grants`).

## Dismissed

- **Month-end clamp drift** (31 January, then the 28th of every later month; `src/plans.ts:23-29`,
  `README.md:98-101`). Kept as a documented rule. Impl review #2 justified it with "a provider
  anchors its own billing day", which no longer holds (MO-3 uses one-time Checkout, not
  subscriptions); the rule itself stands, each payment buys calendar months from where access ends.

## Checked without findings

- Period math across DST, month ends and leap years (`tests/plans.test.ts:31-38`, `src/calendar.ts:49-57`).
- The event resolver runs under the row lock on both grant paths (`grants.ts:49-52`).
- `PaymentProvider` needed no change for Stripe (`src/payment.ts`, one commit).
- Redirect outside the try; errors as codes through the dictionary; Stripe's message never logged.
- `en`/`pl` keys identical; Polish plurals one/few/many/other in `pricing.period`.
- `aria-label` texts from messages (`src/ui/pricing-tiles.tsx:55`); `sft:` tokens only.

## Triage summary
Fixed: -. Accepted: -. Deferred: W1 (FU-25), W2, W3, S5 (FU-26), S1, S2, S3, S4 (FU-27). Dismissed:
month-end clamp. Closed later: lifetime requests and grants, stored requests (FU-9).
Verdict after triage: ready after fixes (retro; the deferred items carry the fixes).

## Decisions (auto)
- W1 provider minor units → Defer to FU-25 (money; needs code and a confirmation of Stripe's rule).
- W2 action guards untested → Defer to FU-26.
- W3 concurrent grants untested → Defer to FU-26.
- S1 hand-over before store → Defer to FU-27.
- S2 control characters → Defer to FU-27.
- S3 one error text → Defer to FU-27.
- S4 retention and price snapshot → Defer to FU-27.
- S5 `adminRole` check → Defer to FU-26.
- Month-end clamp → Dismiss (documented rule; stale reason noted).
