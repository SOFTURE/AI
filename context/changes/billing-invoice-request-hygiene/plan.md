# Plan: billing-invoice-request-hygiene

Input: change.md, research.md. Complexity: medium (one migration, contract change, three behaviours).

## Goal

- A manual request is stored before `onRequest` runs. The owner hears of an open request once:
  asking again refreshes the details and does not call `onRequest`; a hand-over that failed (an
  `Err` or a throw) is tried again on the next ask. The buyer's answer does not change
  (`requested`, or `billing.payment_failed` when the hand-over failed).
- Invoice fields are parsed by a zod schema: trimmed; `name` and `address` required; each field
  has its limit; Unicode control characters (`Cc`) refused in every field. Each field error has its
  own code (`billing.invoice_field_required`, `billing.invoice_field_too_long`,
  `billing.invoice_field_control_characters`) and copy; the too-long copy names the limit. The
  database refuses control characters in new values too.
- `billing({ requests: { expireAfterDays } })` (default 30, 1-365) and `expireStaleRequests(ctx)`:
  open requests not asked again for that long become `expired` with their details cleared. The
  example runs it daily as `npm run expire-invoice-requests`.
- Requests record the plan's `amount` and `currency` when asked (refreshed with the request);
  manual grants record the request's price, or the plan's price for a grant by email or script.
  The admin page shows both; the privacy export carries them. Old rows keep NULL.

**Out of scope:** FU-30, FU-32, FU-33 (lane C, later); a mail to the buyer when a request expires;
showing expired requests in the admin page; Stripe's checkout path (it stores no request).

## Approach

**Starting point:** `startPayment` hands over, then stores (`src/server/plans.ts:134-136`);
`parseInvoiceDetails` is hand-written with one code (`plans.ts:91-101`); nothing closes an old open
request; `manual_grants` has no price (`migrations/0004_create_requests_and_grants.sql:31-56`).

**Chosen:** store, then claim the hand-over with a conditional `UPDATE` on a new `handed_over_at`
column, call the provider only when the claim succeeds, and release the claim when it fails
(research, Decisions). Rejected: one transaction around the mail - holds the request's row lock
across a network call; deleting a request whose hand-over failed - loses the buyer's intent and
races a refresh.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Which providers store | `PaymentProvider.handsOverRequests: boolean` (manual `true`, stripe `false`); a mismatched answer throws | the core must store before the call | research |
| Claim | `UPDATE ... SET handed_over_at = now WHERE id = $1 AND status = 'open' AND handed_over_at IS NULL RETURNING` | one hand-over per open request, concurrent asks included | research |
| Release | on `Err` or throw: `SET handed_over_at = NULL WHERE id AND handed_over_at = <claimed>` | the next ask retries | research |
| Not claimed | answer `requested` without calling the provider | already handed over (or closed meanwhile) | plan |
| Control characters | `\p{Cc}` in every field; DB CHECK `!~ '[\x01-\x1f\x7f-\x9f]'` `NOT VALID` | the address is a one-line input | research |
| Expiry | status `expired`, `closed_at = now`, details NULL; by `requested_at < now - days` | refreshing resets the age | research |
| Price | request: plan price at ask/refresh; grant: closed request's price, else plan price | what was quoted is what is granted | research |
| Migration | `0006_record_request_handover_and_prices.sql` | 0005 is FU-20's | research |

**Critical details:** the claim happens after the upsert in its own statement; the upsert must not
reset `handed_over_at` on refresh. The release compares the claimed timestamp, so it never clears
a later claim.

## Phase 1: Requests stored first, with prices

**Discipline:** TDD. **Files:** `migrations/0006_record_request_handover_and_prices.sql`,
`src/schema.ts`, `src/payment.ts`, `src/manual.ts`, `src/stripe.ts`, `src/server/plans.ts`,
`src/server/requests.ts`, `src/server/grants.ts`, `src/server/privacy.ts`, `src/next/pages.tsx`,
`src/messages/{en,pl}.ts`, tests, `examples/next-app/e2e/migrations.spec.ts`,
`examples/next-app/e2e/billing-pricing.spec.ts`.

1. Migration `0006`: `payment_requests.handed_over_at timestamptz` (open rows: `= requested_at`),
   `payment_requests.amount bigint`, `currency text`, same pair on `manual_grants`, CHECKs
   (`*_price_pair`, amount ≥ 0, currency `^[A-Z]{3}$`), status CHECK with `expired`,
   control-character CHECKs `NOT VALID`. Header with rollback. Run on PGlite first (plan review W1).
2. `payment.ts`: `handsOverRequests` in the interface and `isPaymentProvider`; `manual()` true,
   `stripe()` false.
3. `requests.ts`: `recordPaymentRequest` takes `price`, returns the id; `claimHandOver(ctx, id)` →
   claimed timestamp or null; `releaseHandOver(ctx, id, at)`. `OpenPaymentRequest.price`. A throw from the provider is
   released, then rethrown (plan review S1).
4. `plans.ts` `startPayment`: for `handsOverRequests`, store → claim → provider → release on
   failure; a provider whose answer does not match its flag throws.
5. `grants.ts`: grant price from the closed request's `RETURNING`, else the plan; history entry
   `price: PlanPrice | null`. `privacy.ts`: export the new columns; the export's status admits
   `expired` (plan review W1).
6. Admin rows: a request shows "Price: {price}"; a manual grant "Granted for {amount} on {date}"
   when priced. The example's mail says the admin page holds the latest details (plan review W2).

**Tests:** store before hand-over (the provider sees a stored request); a refresh does not call
`onRequest`; an `Err` and a throw release, and the next ask hands over; two asks at once hand over
once (claim); stripe-like provider stores nothing; a mismatched answer throws; request and grant
prices (request snapshot wins after a price change; email grant takes the plan's); history and
export carry them; e2e: asking twice mails once, the ledger lists `billing 6`.

**Done when:**
- Automated: the store-first, refresh, release and claim tests pass; price tests pass; e2e
  "asking twice mails once" and the ledger pass; Gates green (typecheck, lint, test).

## Phase 2: Invoice fields parsed by a schema

**Discipline:** TDD. **Files:** `src/invoice.ts` (new: schema and parse), `src/server/plans.ts`,
`src/contract.ts`, `src/index.ts`, `src/ui/payment-form.tsx`, `src/messages/{en,pl}.ts`, tests,
`examples/next-app/e2e/billing-pricing.spec.ts`.

1. `src/invoice.ts`: `invoiceDetailsSchema` (zod) and `parseInvoiceDetails` returning per-field
   codes; `INVOICE_FIELD_ERROR_CODES`.
2. `contract.ts`: the three codes join `PaymentFormErrorCode`; `invoice_details_invalid` stays the
   form-level code.
3. Copy: `invoice_field_required`, `invoice_field_too_long` ("{max}"), `invoice_field_control_characters`
   in en and pl; the form formats `{max}` from `INVOICE_LIMITS`.

**Tests:** each code per field; trimmed input; a tab and a newline refused in every field; a
32-character tax id passes, 33 is `too_long`; the form shows the limit; the DB refuses a newline
inserted directly; e2e: a too-long tax id shows its own message (the form's `maxLength` is removed
in the test) and nothing is mailed.

**Done when:**
- Automated: schema and form tests pass; the DB CHECK test passes; e2e passes; Gates green (typecheck, lint, test).

## Phase 3: Stale requests expire

**Discipline:** TDD. **Files:** `src/options.ts`, `src/server/requests.ts`, `src/server/index.ts`,
`examples/next-app/scripts/expire-invoice-requests.ts`, `examples/next-app/package.json`,
`modules/billing/README.md`, tests, `examples/next-app/e2e/billing-pricing.spec.ts`.

1. `options.ts`: `requests: { expireAfterDays: 1-365, default 30 }` with `.prefault({})`.
2. `requests.ts`: `expireStaleRequests(ctx)` → `{ expired: number }`, one conditional `UPDATE`.
3. Example script and npm script, as `send-access-reminders.ts`.
4. README: options, tables (0006), GDPR retention, the daily job; package description; §12: the
   mail may hold older details than the admin page, and two asks at once (plan review W2, S2).

**Tests:** a request older than the age expires and loses its details, a younger one and a closed
one do not; a refresh resets the age; the option's bounds; e2e: a request backdated in the database
expires through the script and leaves the admin list.

**Done when:**
- Automated: expiry tests pass; the e2e passes; Gates green (typecheck, lint, test, build).

## Risks and rollback

- Crash between claim and hand-over → the request stays listed for the admin; expiry clears it.
- Mismatched provider flag → thrown at the first payment; a test covers both providers.
- Rollback: revert the commits; the migration header lists the statements that undo `0006`
  (drop the columns and CHECKs, restore the status CHECK after closing `expired` rows as
  `dismissed`), then delete the ledger row.

## Decisions (auto)

- Default expiry 30 days (research).
- `expired` as a new status, not shown in the admin page (it lists open requests only).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Requests stored first, with prices

#### Automated
- [ ] 1.1 A manual request is stored before `onRequest` runs, and a refresh of a handed-over request does not call it
- [ ] 1.2 A failed hand-over (`Err` or throw) is released and the next ask hands it over; concurrent asks hand over once
- [ ] 1.3 A provider whose answer does not match `handsOverRequests` throws; a checkout provider stores nothing
- [ ] 1.4 Requests and manual grants record amount and currency; history, admin rows and the export show them
- [ ] 1.5 e2e: asking twice mails the owner once; the ledger lists `billing 6`
- [ ] 1.6 Gates green (typecheck, lint, test)

### Phase 2: Invoice fields parsed by a schema

#### Automated
- [ ] 2.1 Each invoice field reports `required`, `too_long` or `control_characters`, and the form names the limit
- [ ] 2.2 The database refuses control characters in new invoice values
- [ ] 2.3 e2e: a too-long tax id gets its own message and nothing is mailed
- [ ] 2.4 Gates green (typecheck, lint, test)

### Phase 3: Stale requests expire

#### Automated
- [ ] 3.1 `expireStaleRequests` expires open requests older than `requests.expireAfterDays` and clears their details; younger and closed ones stay
- [ ] 3.2 e2e: the `expire-invoice-requests` script expires a backdated request
- [ ] 3.3 README documents the option, the job, the columns and the retention
- [ ] 3.4 Gates green (typecheck, lint, test, build)
