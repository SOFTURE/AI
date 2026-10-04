# Research: billing-retro-reviews

Input: change.md, roadmap FU-12, the MO-1 and MO-2 archives. Depth: deep (money, entitlements,
concurrency). Snapshot: b6c92c4 on claude/fu-12-retro-review-0g3oj6, 2026-10-04 00:30 UTC.

## Summary

- MO-1 (`billing-entitlements`) lacks only `reviews/plan-review.md`; MO-2 (`billing-plans-pricing`)
  lacks `research.md` and `reviews/plan-review.md`. Both plans are fully grounded today (MO-1 19/19,
  MO-2 37/37 named paths, symbols and commands exist).
- The billing code moved on since: MO-3 (Stripe, `billing.payments`), FU-11 (one payment's refund,
  migration 0003 drops the lifetime CHECK) and FU-9 (stored requests, manual grants, revoke,
  history, migration 0004). Several MO-2 decisions are superseded; the retro documents must say so.
- Findings that still apply fall into four themes, none covered by an open item: existing accounts
  when billing is enabled (MO-1), Stripe's special currencies (MO-2), untested concurrency and
  action guards (both), and invoice-request hygiene (MO-2).
- No code change belongs to this item (Constraints); each theme becomes one FU item in lane C.

## Current state

- **Derived trial.** An account without a row is on a trial from `auth.users.created_at` plus
  `trial.days`, recomputed on every read (`modules/billing/src/server/entitlements.ts:18-20,37`).
  An account older than `trial.days` is therefore read-only the moment billing is enabled, while
  the README says "accounts created before billing was enabled get a trial too"
  (`modules/billing/README.md:268-270`). The README also says billing replaces FIRE_TRACKER's
  `paid_until` / `trial_ends_at` columns (`README.md:7-11`), but there is no import or pin path.
  Changing `trial.days` or `config.timezone` moves every row-less trial (`README.md:271-272`
  documents only `trial.days`).
- **First change race.** `changeEntitlement` inserts with `onConflictDoNothing` and re-locks
  (`entitlements.ts:94-108`); the only race test runs on PGlite, one connection
  (`modules/billing/tests/entitlements.test.ts:140`, `tests/support.ts:24`). The same holds for
  concurrent grants (`tests/payments.test.ts:50`).
- **Guards.** `requireWriteAccess` fails closed (`src/next/current-entitlement.ts:30-36`); the admin
  and payment actions check the session or role before reading the form (`src/next/actions.ts:44,
  66-67,77,120,162`). No unit test calls any of these with an anonymous or non-admin user; only
  page-level e2e checks exist (`examples/next-app/e2e/billing-pricing.spec.ts:156`).
- **Currencies.** `formatPrice` takes minor-unit digits from `Intl` (`src/price.ts:25-26`): ISK and
  UGX 0, HUF and TWD 2. The Stripe adapter sends `unit_amount = plan.price.amount` unchanged
  (`src/stripe.ts:53`). Stripe's currency guide lists special cases (ISK and UGX displayed without
  decimals but sent ×100 in the API; HUF and TWD amounts divisible by 100); if that holds, an
  ISK 1,500 plan is charged as ISK 15. Inferred from the reviewer's reading of Stripe's docs: the
  page could not be fetched from this session, so the item filed for it starts by confirming it.
- **Manual requests.** `startPayment` hands the request to the provider (the example mails the
  owner) before it stores it (`src/server/plans.ts:135-136`); a failed store leaves the mail sent,
  and a refreshed open request mails again. Invoice fields are trimmed and length-capped by hand
  (`plans.ts:91-101`, `src/fields.ts:13-17`) with no control-character check, and one error text
  covers "missing" and "too long" (`src/messages/en.ts:109`). Open requests keep invoice details
  until closed, with no limit (`migrations/0004_create_requests_and_grants.sql:24`). Manual grants
  store no amount or currency (`0004:31-56`), while README §3 says the price paid lives with the
  provider (`README.md:96`).
- **Month periods** clamp to the month's last day and renewals continue from there
  (`src/plans.ts:23-29`, `README.md:98-101`); MO-2's impl review kept it because "a provider anchors
  its own billing day", but MO-3 uses one-time Checkout, not subscriptions.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| MO-1 archive | `context/archive/2026-10-03-billing-entitlements/reviews/plan-review.md` (new) | the missing plan review |
| MO-2 archive | `context/archive/2026-10-03-billing-plans-pricing/research.md`, `reviews/plan-review.md` (new) | the missing research and plan review |
| Followups | `context/backlog/roadmap-followups/<id>/change.md` (new), its README, `context/foundation/roadmap.md` | each finding that still applies becomes an FU item |

## Data

None changed. Read for the review: migrations 0001-0004 (`modules/billing/migrations/`).

## Tests

The billing unit suites pass on master (MO-1 scope 86 tests, MO-2 scope 62 tests, `npx vitest run
modules/billing`). This change adds no code; its gates are the repository tests that guard docs:
relative links in every `*.md` and the roadmap contract (`tests/repo/`).

## Patterns to follow

- A plan review's shape: `context/archive/2026-10-03-billing-admin-requests/reviews/plan-review.md`.
- A research document's shape: `context/archive/2026-10-03-billing-admin-requests/research.md`.
- A gap entry: `context/backlog/roadmap-followups/README.md` "Adding a gap", e.g.
  `billing-grant-plan-script/change.md`, and its roadmap block (`roadmap.md`, FU-22).

## Prior work

- MO-3 `archive/2026-10-03-billing-provider-adapter/research.md:8,77`: `PaymentProvider` kept as
  MO-2 defined it; `plan.md:16` one-time Checkout because `grantPlan` stacks periods.
- FU-11 `archive/2026-10-03-billing-refund-one-payment/`: `shorten` replaces `revoke` for refunds;
  migration 0003 keeps `paid_until` under lifetime; `applyPlan` returns its grant.
- FU-9 `archive/2026-10-03-billing-admin-requests/`: requests stored by `startPayment`, admin grants
  through `grantPlanManually` with a record, revoke per grant, `billing.lifetime_active`.

## SOFTURE modules

Not applicable: the item writes documents about `@softure-ai/billing` itself.

## Risks

- Filing duplicates of open items. Mitigation: open billing items are FU-6, FU-20, FU-21, FU-22,
  MO-6, LT-1; README §12 lines already owned by them are not refiled.
- Touching lane C's files. Mitigation: no file under `modules/` changes.
- Writing into `context/archive/`. Mitigation: only new files, as the roadmap outcome asks.

## Relevant lessons

None: L-001 and L-002 concern builds and Next imports.

## Answers to unknowns

- **Whether findings need code changes in `modules/billing/`:** yes, four themes (Current state);
  they become FU-24 to FU-27 (FU-23 is the highest number in use, `roadmap.md:67`).

## Open questions

- Should the retro findings be fixed here? **Decided (owner, 2026-10-03):** gaps go to the followups
  roadmap, not fixed on the spot; lane C owns billing code.
- Month-end clamp: **decided (auto):** a documented product rule, not a defect; the plan review
  records that its stated reason is stale, and no item is filed.
