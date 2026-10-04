# Research: billing-invoice-request-hygiene

Input: change.md, roadmap FU-27, FU-12's retro plan review of MO-2 (S1-S4). Depth: normal (personal
data, one forward-only migration, no money moved).
Snapshot: e9d910a on master, 2026-10-04 07:20 UTC.

## Summary

- `startPayment` hands the request over (the example mails the owner) before it stores it, and
  hands it over again on every ask (`modules/billing/src/server/plans.ts:134-136`). Storing first
  needs a record of whether the owner was told: a new `handed_over_at` column, claimed with a
  conditional `UPDATE` before the hand-over and released when it fails. A refresh of a request
  already handed over then skips the provider, and a failed hand-over is tried again on the next ask.
- The core cannot know before the call whether a provider answers `requested` (stored) or
  `redirect` (Stripe). The contract needs a flag: `PaymentProvider.handsOverRequests`.
- `parseInvoiceDetails` (`plans.ts:91-101`) becomes a zod schema; codes per field: `required`,
  `too_long`, `control_characters`. Every field refuses Unicode `Cc` (the form's address is a
  one-line input, `src/ui/payment-form.tsx:89-98`, so no field needs a newline).
- Retention: `requests.expireAfterDays` (default 30) and `expireStaleRequests(ctx)`, run daily by
  the app's scheduler like the reminder mail; expired requests get status `expired`, details cleared.
- Migration `0006` (0005 is FU-20's): `handed_over_at`, `amount`/`currency` on both tables (NULL on
  old rows), status `expired`, control-character CHECKs as `NOT VALID`.

## Current state

- Payment page → `startPaymentAction` (`src/next/actions.ts:43-58`) → `startPayment`
  (`src/server/plans.ts:117-138`): bucket, plan, lifetime check, invoice parse (only when
  `provider.collectsInvoiceDetails`), `provider.startPayment`, then `recordPaymentRequest` when
  the answer is `requested`.
- `manual({ onRequest })` (`src/manual.ts:16-31`) calls `onRequest`; an `Err` becomes
  `billing.payment_failed` (logged). The example's `onRequest` mails the owner with the name, tax id
  and address in the body (`examples/next-app/lib/invoice-requests.ts:15-36`,
  `messages/en.ts:57`), keyed by a random idempotency key, so every call is a new mail.
- `recordPaymentRequest` (`src/server/requests.ts:41-57`) upserts on the partial unique index
  `payment_requests_one_open` and refreshes details and `requested_at`.
- Closing (`getClosedRequestColumns`, `requests.ts:36-38`) clears the details; nothing closes an
  open request except the admin (`grantPlanManually` `src/server/grants.ts:58-66`,
  `dismissPaymentRequest` `requests.ts:94-103`).
- `grantPlanManually` inserts `manual_grants` with no price (`grants.ts:73-86`); the history entry
  has no amount (`grants.ts:138-147`), unlike provider payments (`pages.tsx:191-201`).
- Field errors: one code `billing.invoice_details_invalid` per field; the copy says "Fill in this
  field (it may not be too long)." (`src/messages/en.ts:128`, `pl.ts:130`).

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Contract | `src/payment.ts`, `src/manual.ts`, `src/stripe.ts`, `src/contract.ts` | `handsOverRequests`; field error codes |
| Parsing | `src/fields.ts` or a new `src/invoice.ts`, `src/server/plans.ts` | zod schema, store-then-hand-over |
| Requests | `src/server/requests.ts`, `src/server/index.ts` | claim/release, price, expiry |
| Grants | `src/server/grants.ts`, `src/server/privacy.ts` | price snapshot, history, export |
| Options | `src/options.ts` | `requests.expireAfterDays` |
| Data | `migrations/0006_*.sql`, `src/schema.ts` | columns, status, CHECKs |
| UI/copy | `src/ui/payment-form.tsx`, `src/next/pages.tsx`, `src/messages/{en,pl}.ts` | too-long message with its limit; prices in admin rows |
| Example | `examples/next-app/scripts/expire-invoice-requests.ts`, `package.json`, `e2e/billing-pricing.spec.ts`, `e2e/migrations.spec.ts` | scheduler entry, e2e, ledger |
| Docs | `modules/billing/README.md` | §3 options, §5 tables, §11 GDPR |

## Data

- `billing.payment_requests` (`0004`): status CHECK is the inline `payment_requests_status_check`
  (`open`, `granted`, `dismissed`); `payment_requests_details_while_open` holds closed rows empty;
  `payment_requests_open_by_age` indexes `requested_at` of open rows, which the expiry sweep uses.
- Existing open rows were all handed over (they were stored only after a successful hand-over), so
  `handed_over_at = requested_at` is a correct backfill.
- Prices of existing rows are unknown (the config is not in the migration's reach): NULL, and the
  code always writes both. A CHECK ties them (`amount IS NULL = currency IS NULL`). A NOT NULL
  cannot be added `NOT VALID`-style for new rows only: Postgres checks every updated row, and
  closing an old request updates it.
- Control characters: a CHECK `invoice_name !~ '[\x01-\x1f\x7f-\x9f]'` (and the same for tax id
  and address) added `NOT VALID`, so old rows are not rewritten, while inserts, refreshes and
  closes are checked (a close writes NULL, which passes).

## Tests

- `tests/payments.test.ts:90-220` (startPayment, recorder provider), `tests/grants.test.ts`
  (requests, grants, history), `tests/next-guards.test.ts` (actions), `tests/privacy.test.ts`
  (export shape), `tests/pricing.test.tsx` (form), `tests/admin-ui.test.tsx`, `tests/module.test.ts`
  (options). All on PGlite via `tests/support.ts`; Postgres tests in `tests/lock-races.test.ts`.
- e2e: `examples/next-app/e2e/billing-pricing.spec.ts:104-128` reads the owner's mail from the
  outbox; `e2e/migrations.spec.ts:13-17` lists the billing ledger.

## Patterns to follow

- Conditional `UPDATE ... RETURNING` as the claim (`dismissPaymentRequest`, `requests.ts:97-102`).
- A daily job as a plain script with `systemClock`, JSON summary on stdout
  (`examples/next-app/scripts/send-access-reminders.ts`).
- Options with `.prefault({})` groups and documented keys (`src/options.ts:57-82`).
- Migration header with what and how to roll back (`migrations/0005_record_refunded_amounts.sql:1-7`).
- zod at the boundary, codes as values (AGENTS.md); messages through `getBillingErrorMessage`.

## Prior work

- MO-2 `context/archive/2026-10-03-billing-plans-pricing/` (manual adapter, retro review S1-S4).
- FU-9 `context/archive/2026-10-03-billing-admin-requests/` (requests and grants tables, details
  cleared on close).
- FU-26 `context/archive/2026-10-04-billing-guard-race-tests/` (action guard tests, Postgres helpers).

## SOFTURE modules

Mailing: not touched; the example's `onRequest` stays its only sender. Privacy: billing's
contributor exports the new columns. Nothing generic is built here.

## Risks

- A claimed hand-over that crashes between the claim and the provider call leaves the request
  marked as handed over though no mail went out. Low (a process crash in a few milliseconds); the
  admin page still lists the request. Mitigation: release in a `finally`-style path on errors and
  throws; documented.
- A provider that sets `handsOverRequests` but answers `redirect` (or the reverse) is a contract bug:
  throw with a message naming the provider.
- Expiry deletes nothing but the details; an admin who wanted an old request sees it gone from the
  list. The age is configurable and the buyer can ask again.

## Relevant lessons

- L-002 (Next imports without `.js`) applies to `src/next/`.

## Answers to unknowns

- **Default age:** 30 days. Common invoice terms are 7-14 days (14 is the usual Polish B2C/B2B
  term); 30 covers the term plus a bank transfer and a reminder. Range 1-365 days.
- **Migration:** `0006` (0005 is taken), on both tables; existing rows keep NULL prices and get
  `handed_over_at = requested_at` when open.
- **Refresh mails again:** skipped when the open request was handed over; the admin page always
  shows the latest details.
- **Newlines in the address:** not allowed (one-line input); every field refuses `Cc`.

## Open questions

None open. Decided here: the flag on the provider, status `expired`, 30 days, claim/release.

## Decisions (auto)

- Store first, claim with `handed_over_at`, release on failure (vs. a transaction around the mail:
  holds a row lock across a network call, and a slow provider blocks the admin's grant).
- A failed hand-over keeps the request open (vs. deleting it): the buyer's intent stands, the admin
  sees it, the next ask retries, and expiry clears it if nobody acts.
- Status `expired` (vs. reusing `dismissed`): the export and the data say why it closed.
- Price of a grant from a request: the request's snapshot (what was quoted), else the plan's price now.
