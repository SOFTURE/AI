# @softure-ai/billing

**Status:** wave 3 · entitlements and the write guard (MO-1); plans, pricing tiles, the payment page
and the manual adapter (MO-2); Stripe Checkout with verified webhooks and refunds (MO-3); stored
invoice requests, recorded manual grants with revoke and an account history (FU-9) · depends on: core, db, ui, security, auth

Decides whether an account may still write: a trial every account starts with, paid access (dated
or lifetime) and a read-only state once both end. It replaces FIRE_TRACKER's access logic
(`src/lib/access.ts`, `src/db/access.ts`, `src/components/{access-badge,access-notice*}.tsx`), with
the `paid_until` and `trial_ends_at` columns moved off the users table into `billing.entitlements`
and the hand-written guard replaced by a pure state machine. FIRE's hard-coded prices and its access
script become plans in the config, a payment page and an admin page that grants a plan.

## 1. What it provides

- **A pure state machine** (`resolveEntitlement`, `applyEntitlementEvent` from the root entry): a
  record (trial end, paid until, lifetime) and an instant give `trial | paid | read_only`, with the
  days left and whether the reminder window is open; an event (`grant`, `grant_lifetime`, `revoke`,
  `shorten`, `end_lifetime`, `extend_trial`) gives the next record. No database and no clock.
- **`billing.entitlements`**, at most one row per account, apart from `auth.users`. An account
  without a row is on the trial that starts at its `auth.users.created_at` (see §5).
- **The write guard**: `requireWriteAccess()` (`/next`) for server actions, `checkWriteAccess()`
  (`/server`) for other hosts.
- **`getEntitlement()`** and `getCurrentEntitlement()` to read where an account stands, and
  **`changeEntitlement()`**, the one write path (grants, revokes, trial extensions) the payment
  adapters build on.
- **`AccessBadge` and `AccessNotice`** (`/ui`), standalone with slots, `unstyled` and messages, and
  `CurrentAccessBadge` / `CurrentAccessNotice` (`/next`) wired to the signed-in account.
- **Plans in the config** (`billing({ plans })`): name, description, price in the currency's minor
  unit, period (days, weeks, months, years or lifetime), feature lines; `formatPrice` and the
  period copy follow the app's locale.
- **`PricingTiles`** (`/ui`) and **`Pricing`** (`/next`, wired to the config), a **`PaymentPage`**
  to mount at `routes.payment`, and a **`BillingAdminPage`** at `routes.admin` where an admin
  works the open invoice requests (grant or dismiss each), grants a plan by email, and looks up an
  account's history of grants and payments with a revoke button on each manual grant.
- **A `PaymentProvider` interface** and its first adapter, **`manual({ onRequest })`**: the buyer
  requests an invoice, the app hands the request to its owner (a mail, a ticket), and the owner
  grants the plan once it is paid. The request is stored in `billing.payment_requests` until the
  admin grants or dismisses it. **`grantPlanManually()`** grants and records a plan in
  `billing.manual_grants`; **`revokeManualGrant()`** takes back only what one grant added.
- **`stripe()`**, a card, BLIK and transfer adapter on Stripe Checkout (one-time payments), and
  **`stripeWebhookRoute`** (`/next`): a verified Stripe webhook that grants a paid checkout's plan
  and, on a full refund, takes back what that one payment granted, exactly once per payment,
  recorded in `billing.payments` (see "Refunds" below).
- Export and deletion of the entitlement row, the payments, the invoice requests and the manual grants (`@softure-ai/privacy`), and a health check for
  `GET /api/health`.

## 2. Installation

```bash
npm install @softure-ai/billing @softure-ai/auth @softure-ai/security @softure-ai/core @softure-ai/db @softure-ai/ui drizzle-orm zod
```

Peer dependencies: `next` 16, `react` 19, `drizzle-orm`. The module depends on `security` and
`auth`; a configuration without them fails at startup.

## 3. Configuration

```ts
import { billing, BILLING_RATE_LIMIT_BUCKETS, manual } from "@softure-ai/billing";

// in defineSoftureConfig({ timezone: "Europe/Warsaw", modules: [...] }):
security({ buckets: { ...AUTH_RATE_LIMIT_BUCKETS, ...BILLING_RATE_LIMIT_BUCKETS } }),
// ... auth(...), then:
billing({
  trial: { days: 14, reminderDays: 3 },
  paid: { reminderDays: 7 },
  plans: [
    { id: "monthly", name: { en: "Monthly", pl: "..." }, price: { amount: 2900, currency: "PLN" }, period: "month", features: [{ en: "Unlimited notes" }] },
    { id: "yearly", name: { en: "Yearly" }, price: { amount: 29000, currency: "PLN" }, period: "year", isFeatured: true },
    { id: "lifetime", name: { en: "Lifetime" }, price: { amount: 79000, currency: "PLN" }, period: "lifetime" },
  ],
  payment: manual({ onRequest: async (request, ctx) => sendInvoiceRequestMail(request, ctx) }),
}),
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `trial.days` | integer 0 to 365 | `14` | Length of the trial every account starts with, the registration day included. `0`: no trial, an account is read-only until it pays. |
| `trial.reminderDays` | integer 0 to 365 | `3` | From how many days left the trial counts as ending (badge tone, notice). `0`: never. |
| `paid.reminderDays` | integer 0 to 365 | `7` | The same for dated paid access. Lifetime access never ends. |
| `plans` | array, at most 12 | `[]` | The plans, in the order the tiles show them (see below). |
| `payment` | `PaymentProvider` | — | The adapter the payment page uses: `stripe()` or `manual({ onRequest })`. The payment page throws without one. |
| `adminRole` | role | `admin` | The auth role that may grant plans in `BillingAdminPage`; declare any other in `auth({ roles })`. |
| `routes.payment` | path | `/payment` | Where `PaymentPage` is mounted; the notice and the tiles link there, and Stripe Checkout returns there. |
| `routes.admin` | path | `/admin/billing` | Where `BillingAdminPage` is mounted; its actions revalidate it, and the account lookup sends the admin there with `?account=<id>`. |
| `routes.webhook` | path | `/api/billing/webhook` | Where `stripeWebhookRoute` is mounted (the Stripe endpoint's URL). |
| `messages` | partial `en` / `pl` | — | Copy overrides. |

**A plan** is `{ id, name, description?, price: { amount, currency }, period, features?, isFeatured? }`:
`id` kebab-case and unique; `name`, `description` and each feature line a text per locale with at
least `en`; `amount` an integer in the currency's minor unit (2900 is 29.00 PLN, 1500 is ¥1,500);
`currency` an upper-case ISO 4217 code; `period` `"day"`, `"week"`, `"month"`, `"year"`,
`"lifetime"` or `{ unit, count }` such as `{ unit: "month", count: 3 }`. A plan has one currency; a
second currency is a second plan. Plans live in the config, not in a table: a price change is a
deploy, and a payment record (with the price paid) belongs to the provider.

**A paid period** runs in local calendar days like a trial, the start day included: a month granted
on 3 October covers every day to 2 November and ends when 3 November begins. It starts when the
access the account already has ends (a running trial or paid access), so paying early loses no day,
and each grant adds one period. A month keeps the day of the month where it can: from 31 January it
ends with 27 February (the 28th starts the next period), and renewals then continue from the 28th.
A lifetime plan grants lifetime access; a dated grant to a lifetime account changes nothing.

**Stripe.** `stripe({ secretKey?, apiBase?, fetch? })` reads `STRIPE_SECRET_KEY` on every payment
(so the config loads at build time without it) and creates one Checkout session per payment
(`mode: "payment"`): the plan's price as a one-off line item in its currency, the plan's name in the
app's locale, the buyer's email, and the account id and plan id in the session's and the
PaymentIntent's metadata (`softure_user_id`, `softure_plan_id`). The buyer returns to
`routes.payment` with `?checkout=success` (the page thanks them; access follows the webhook, usually
within seconds) or `?plan=<id>&checkout=cancelled`. Payment methods are the ones enabled in the
Stripe dashboard (cards, BLIK, Przelewy24, transfers). A refusal, a timeout or a missing key is
`billing.payment_failed` for the buyer and one log line (HTTP status and Stripe's error type and
code, never its message or the key). Subscriptions are not used: each payment buys one period, and
renewing is paying again, as with `manual()`.

**Days and time zones.** Trials end at the start of a local day in `config.timezone`: a 14-day
trial begun at any hour of 3 October ends when 17 October begins there, so 16 October is its last
day. Days left count local calendar days, today included (1 on the last day). Access covers every
instant before its end; at the end itself the account is read-only. Paid access wins over a trial;
a trial that outlasts paid access takes over again when the payment ends.

## 4. Mounting

Mount the payment page at `routes.payment` and the admin page at `routes.admin`, one line each:

```ts
// app/payment/page.tsx
export { PaymentPage as default } from "@softure-ai/billing/next";
// app/admin/billing/page.tsx
export { BillingAdminPage as default } from "@softure-ai/billing/next";
// app/api/billing/webhook/route.ts (with stripe(); public, outside any auth guard)
export { stripeWebhookRoute as POST } from "@softure-ai/billing/next";
```

**The Stripe webhook.** In the Stripe dashboard, add an endpoint at `<appOrigin>/api/billing/webhook`
for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `charge.refunded`,
and put its signing secret in `STRIPE_WEBHOOK_SECRET` (locally: `stripe listen --forward-to
localhost:3000/api/billing/webhook` prints one). The route checks `Stripe-Signature` (HMAC-SHA256,
at most five minutes old, any `v1` entry during a secret rotation) before it parses the body (at
most 256 KiB) or touches the database, then:

| Delivery | Effect | Answer |
| --- | --- | --- |
| a paid checkout (`completed` with `payment_status` `paid` or `no_payment_required`, or `async_payment_succeeded`) | the payment is stored and its plan granted, in one transaction | 200 |
| the same checkout again (a retry, or both events of a delayed payment) | nothing | 200 |
| a checkout still waiting for a transfer, a partial refund, any other event, a session billing did not create | nothing | 200 |
| `charge.refunded` with `refunded: true` for a stored payment | the payment is marked refunded and what it granted taken back, once | 200 |
| a paid checkout whose account was deleted or whose plan left the config | nothing stored; one log line with the checkout id to refund in Stripe | 200 |
| no or a wrong signature, a replay, a body that is not a Stripe event | nothing | 400 |
| no `STRIPE_WEBHOOK_SECRET`, a database failure | nothing; Stripe retries | 500 |

**Refunds.** Each payment row records what its grant added: a period (from where access ended, the
trial's end or the payment's instant, to the period's end) or lifetime access. A full refund takes
back only that, with the pure `getRefundEvent` (root entry):

- **A period** loses its unused days, `[max(from, now), until)`, counted in local days of the app's
  time zone: the dated end moves back by that many days. Access ahead of now is one unbroken run
  (every grant starts where running access ends), so the other stacked periods, manual grants and
  the trial keep their length. A period already used up takes nothing back, and an old payment
  refunded after a lapse never touches a newer period. The stored periods of the payments stacked
  after it move back by the same days, so a later refund of one of them takes back the right
  days. A dated end moved to the trial's end or before it drops paid access: the account is back
  on its trial.
- **A lifetime** ends lifetime access unless another lifetime payment of the account is still
  `paid`. Lifetime keeps the dated end beside it (a grant on lifetime still extends it), so the
  months bought next to a refunded lifetime stay.
- **A payment stored before grants were recorded** (no grant columns) revokes paid access, as
  before.

The decision is made under the entitlement row's lock, so a lifetime bought at the same moment is
either seen or granted after the refund.

There is no rate limit on the route: Stripe sends from a few addresses, and an unsigned request costs
one HMAC.

`PaymentPage` needs a session (a visitor goes to the login page and back) and shows the account's
badge and the plans; with `?plan=<id>` it shows the order and the provider's form: the invoice
details for `manual()`, one checkout button for a hosted provider. An account with lifetime access
sees that it has nothing left to pay for instead of the order (`startPayment` refuses it with
`billing.lifetime_active`). Show the plans anywhere else, e.g. a public pricing page, with
`<Pricing LinkComponent={Link} />`.

**The admin page.** `BillingAdminPage` answers "not found" to anyone without `adminRole`; every
action checks the role from the session again before reading its form. It has three cards:

- **Invoice requests**: the open requests, oldest first, with the account, the plan, when it was
  asked for and the invoice details. **Grant** applies the plan and closes the request in one
  transaction (`grantPaymentRequest`); **Dismiss** closes it without a grant; **History** opens the
  account's history. A request is granted or dismissed once: a second click finds it closed.
- **Grant access**: a plan for the account with a given email, recorded like a request's grant.
  An account with lifetime access is refused (`billing.lifetime_active`): a dated period under
  lifetime would be invisible.
- **Account history**: the email lookup sends the admin to `?account=<id>` (no address in a URL),
  which shows the account's badge and its manual grants and provider payments, newest first, each
  with the access it added and its state. **Revoke** on an active manual grant takes back only
  what it added, like a refund: a period loses its unused days and the periods stored after it
  (manual or paid) move back; a lifetime ends unless another active manual lifetime or a paid
  lifetime payment still gives it. Provider payments are refunded at the provider, not here.

Guard every write action of the app, before reading any input:

```ts
"use server";
import { requireWriteAccess } from "@softure-ai/billing/next";

export async function saveNote(formData: FormData) {
  const access = await requireWriteAccess(); // no session: redirects to the login page
  if (!access.ok) return access; // Err("billing.read_only"), for the form to show
  // ... the app's own authorization and the write, as access.value.user
}
```

Show where the account stands in any server component (both render nothing without a session):

```tsx
import { CurrentAccessBadge, CurrentAccessNotice } from "@softure-ai/billing/next";
import Link from "next/link";

<CurrentAccessBadge />
<CurrentAccessNotice LinkComponent={Link} />
```

Server functions, for scripts and other hosts (`@softure-ai/billing/server`):
`grantPlanManually(ctx, { userId, planId, adminId, requestId? })` grants one payment of a plan,
records it in the account's history (closing the request when given) and returns
`{ grantId, entitlement }` (`Err<billing.plan_unknown | billing.account_unknown |
billing.lifetime_active | billing.request_closed>` otherwise); `grantPaymentRequest(ctx, { requestId,
adminId })` does it for an open request; `revokeManualGrant(ctx, { grantId, adminId })` takes one
back (`Err<billing.grant_revoked>` when it was revoked before); `getAccountHistory(ctx, userId)`,
`listOpenRequests(ctx, limit?)`, `dismissPaymentRequest(ctx, requestId)`. `grantPlan(ctx, userId,
planId)` grants without a record: nothing to revoke, not in the history; scripts that grant for
an admin use `grantPlanManually`. `startPayment(ctx, input)` counts the `billing-payment` bucket
per account, checks the plan, lifetime access and the invoice details, calls the provider and
stores a request the provider handed over; `findAccountByEmail(ctx, email)`,
`findAccountById(ctx, id)`, `getBillingPlans(config)`.
`receiveStripeWebhook(ctx, { payload, signature, secret })` is the route without Next;
`recordPayment(ctx, { provider, checkoutId, paymentId, userId, planId, amount, currency })` and
`refundPayment(ctx, { provider, paymentId })` are its two writes, for another provider's webhook.
`getEntitlement(ctx, userId)` returns the `Entitlement` or null for an unknown account;
`checkWriteAccess(ctx, userId)` returns `Ok<Entitlement>` or `Err<billing.read_only | billing.account_unknown>`;
`changeEntitlement(ctx, userId, event)` returns the `Entitlement` after the change or
`Err<billing.end_not_in_future | billing.account_unknown>`. A refused event writes nothing. `event`
may also be a function of the current record, run under the row's lock (how `grantPlan` extends a
period without losing a concurrent grant).

**A payment provider** (`PaymentProvider` from the root entry) has a `name`, says whether the page
collects invoice details (`collectsInvoiceDetails`), and implements
`startPayment(ctx, { plan, account, invoice, returnUrl })`, which resolves with
`{ type: "redirect", url }` (a hosted checkout; the action redirects there), `{ type: "requested" }`
(handed over; the page confirms and billing stores the request for the admin page) or
`Err<billing.payment_failed>`. Granting access afterwards goes through `grantPlanManually` (an
admin) or `recordPayment` (a webhook).

## 5. Migrations and tables

`migrations/0001_create_entitlements.sql` creates `billing.entitlements`:

| Column | Meaning |
| --- | --- |
| `user_id` | `uuid`, primary key, references `auth.users(id)` `ON DELETE CASCADE`. |
| `trial_ends_at` | The first instant the trial no longer covers. |
| `paid_until` | The first instant dated paid access no longer covers; NULL when never paid or revoked. Kept under lifetime (since `0003`). |
| `is_lifetime` | Paid access without an end; it wins over `paid_until`. |
| `created_at`, `updated_at` | The first change and the last one. |

**No row until something changes.** Reads never write: an account without a row gets its trial
derived from `auth.users.created_at` and `trial.days`, so accounts created before billing was
enabled get a trial too and auth's single `onRegistered` hook stays free for the app. The first
change (`changeEntitlement`) stores that derived trial end with the event applied, so the trial end
never moves when a row appears. Until then, a change of `trial.days` changes the trial of accounts
without a row.

`migrations/0002_create_payments.sql` creates `billing.payments`, one row per paid provider checkout:

| Column | Meaning |
| --- | --- |
| `id` | `uuid`, primary key. |
| `user_id` | The account, references `auth.users(id)` `ON DELETE CASCADE`. |
| `provider` | The adapter's name, `stripe`. |
| `checkout_id` | The provider's checkout (`cs_...`); unique per provider: a checkout grants once. |
| `payment_id` | The provider's payment (`pi_...`) refunds name; unique per provider; NULL for a free checkout. |
| `plan_id`, `amount`, `currency` | The plan and what the provider charged, in the currency's minor unit. |
| `status`, `paid_at`, `refunded_at` | `paid` or `refunded`; a CHECK ties `refunded_at` to the status. |
| `grant_kind`, `granted_from`, `granted_until` | What the payment granted (`0003`): `period` with its start and end, or `lifetime` with no dates; all NULL for rows recorded before. A CHECK (`payments_grant_shape`) ties the dates to the kind. |

`migrations/0003_record_payment_grants.sql` adds the grant columns and drops the CHECK that kept
`paid_until` NULL under lifetime.

The insert, the grant and its grant columns share a transaction, as do the refund's conditional update and the change it makes,
so a delivery seen twice changes nothing. Every write takes the account first (like the privacy
erase); a refund and a manual revoke then take the entitlement before their own row, since moving
the later periods back updates other rows under that lock.

`migrations/0004_create_requests_and_grants.sql` creates the manual payments' two tables:

`billing.payment_requests`, one row per invoice request:

| Column | Meaning |
| --- | --- |
| `id`, `user_id`, `plan_id` | The request, its account (`ON DELETE CASCADE`) and the plan asked for. |
| `invoice_name`, `invoice_tax_id`, `invoice_address` | The details as typed, kept **only while the request is open**: closing it clears them (CHECK `payment_requests_details_while_open`). |
| `status`, `requested_at`, `closed_at` | `open`, `granted` or `dismissed`; a CHECK ties `closed_at` to the status. |

One open request per account and plan (partial unique index `payment_requests_one_open`): asking
again refreshes its details and time.

`billing.manual_grants`, one row per plan an admin granted:

| Column | Meaning |
| --- | --- |
| `id`, `user_id`, `plan_id` | The grant, its account (`ON DELETE CASCADE`) and the plan. |
| `request_id` | The request it answered (unique), or NULL for a grant by email. |
| `granted_by`, `revoked_by` | The admins (`ON DELETE SET NULL`). |
| `granted_at`, `grant_kind`, `granted_from`, `granted_until` | What it added, as `billing.payments` records it (CHECK `manual_grants_grant_shape`). |
| `status`, `revoked_at` | `active` or `revoked`; CHECKs tie `revoked_at` and `revoked_by` to the status. |

A grant and the request it closes share a transaction; a grant and a revoke take the account, then
the entitlement, then their row (a conditional update), the order of a refund.

## 6. Environment variables

| Name | Required | Meaning |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | with `stripe()` unless `stripe({ secretKey })` | The secret API key (`sk_test_...` in the sandbox), read on every payment. |
| `STRIPE_WEBHOOK_SECRET` | when `stripeWebhookRoute` is mounted | The webhook endpoint's signing secret (`whsec_...`). |

## 7. Switches

None.

## 8. Appearance

`AccessBadge` takes `classNames` for its slots `root`, `status` and `detail`; the status colour
follows the state (`--sft-color-foreground` for a trial, `success` when paid, `warning` in a
reminder window, `danger` when read-only). It sets `data-status` and, in a reminder window,
`data-ending="true"` for app styles. `AccessNotice` takes `root`, `message` and `actions` and
renders the `@softure-ai/ui` `ButtonLink`; ended access uses the danger surface of `FormError`.
Both accept `unstyled`. `PricingTiles` takes `root`, `tile`, `badge`, `name`, `description`,
`priceRow`, `price`, `period`, `features`, `feature`, `featureIcon` and `action`; a featured or chosen
tile gets `--sft-border-strong` and a shadow, and sets `data-plan`, `data-featured` and
`aria-current`. `PaymentForm` and `GrantForm` take `root`, `form` and `notice`.

## 9. Copy

`billingMessages` (`en`, `pl`): `badge` (status names, `daysLeft` plural forms, `until`), `notice`
(the four notices and their two link texts), `pricing` (period plural forms per unit, `lifetime`,
`featured`, `choose`, `empty`), `payment` (the payment page, the invoice form and the notices after a
hosted checkout, `checkoutSuccess` and `checkoutCancelled`), `admin` (the
grant form) and `errors`. Plan names, descriptions and features come from the config, per locale. `{date}` is the last day of access in
the app's locale and time zone, `{count}` the days left. Override them with
`billing({ messages: { en: { notice: { choosePlan: "See plans" } } } })`.

## 10. Hooks

`manual({ onRequest(request, ctx) })` receives every invoice request (plan, account, invoice
details, return URL) and resolves with `Ok` once handed over, or an `Err` the buyer sees as
`billing.payment_failed`. Apps react to a change in their own code around `changeEntitlement` and
`grantPlan`. The Stripe webhook has no hook yet; its effect shows in `getEntitlement`.

## 11. GDPR

- Export: the account's entitlement row (`trialEndsAt`, `paidUntil`, `isLifetime`, `createdAt`,
  `updatedAt`), or `entitlement: null` for an account without one, its payments oldest first
  (`provider`, `checkoutId`, `paymentId`, `planId`, `amount`, `currency`, `status`, `paidAt`,
  `refundedAt`, `grantKind`, `grantedFrom`, `grantedUntil`), its invoice requests (`planId`, the
  invoice details while open, `status`, `requestedAt`, `closedAt`) and the plans granted to it by
  hand (`planId`, `grantedAt`, the grant, `status`, `revokedAt`). Which admin granted or revoked
  is the admin's data and stays out of the account's export.
- Deletion: the row, the payments, the requests and the manual grants, and the foreign keys remove
  them with the account too; an erased admin's id is cleared from the grants they made.
  Stripe keeps its own record of each payment (the controller's accounting record there).
- Retention: invoice details are personal data the app needs only until the request is handled,
  so granting or dismissing it erases them. What `onRequest` delivered (the mail to the owner) and
  the issued invoice are the app's and the owner's own records.

## 12. Limitations

- A partial refund changes nothing (followups FU-20). A refund that reaches the app before its
  checkout (Stripe does not order events) finds no payment and is not retried.
- A refunded paid lifetime ends a lifetime the admin granted by hand too: the refund counts only
  paid lifetime payments, not `billing.manual_grants` (followups FU-21). A revoke of a manual
  lifetime does count paid ones. A dated manual grant keeps its length.
- A refund of a period moves the dated end back by local days; a `grant { until }` an app applies
  by hand with an end inside the stack is not a period of its own and shifts with it.
- A payment recorded before migration `0003` has no grant: its refund revokes all paid access.
- The Stripe adapter is tested against the sandbox's Checkout API (when `STRIPE_SECRET_KEY` holds a
  test key) and with signed webhook fixtures; a browser payment end to end in the sandbox is
  item LT-1 of the later roadmap (`context/foundation/roadmaps/roadmap-later.md`).
- A grant through `grantPlan` (or a raw `changeEntitlement`) is not recorded: it is not in the
  history and cannot be revoked. There is no `grant-plan` ops script for hosts without the admin
  page (followups FU-22).
- The admin page lists up to 50 open requests and 100 entries of each source in a history; there
  is no paging.
- The write guard is per action: a read-only account can still call a write the app did not guard.
- No reminder mail: the notice shows in the app only (followups FU-6).
- No history of entitlement changes beyond grants: a row holds the current state; provider
  payments and manual grants are stored, trial extensions and raw events are not.
