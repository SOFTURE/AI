# @softure-ai/billing

**Status:** wave 3 · entitlements and the write guard (MO-1); plans, pricing tiles, the payment page
and the manual adapter (MO-2); Stripe Checkout with verified webhooks and refunds (MO-3); stored
invoice requests, recorded manual grants with revoke and an account history (FU-9); reminder mail
before and after access ends (FU-6) · depends on: core, db, ui, security, auth (mailing optional, for
`@softure-ai/billing/mailing`)

Decides whether an account may still write: a trial every account starts with, paid access (dated
or lifetime) and a read-only state once both end. It replaces FIRE_TRACKER's access logic
(`src/lib/access.ts`, `src/db/access.ts`, `src/components/{access-badge,access-notice*}.tsx`), with
the `paid_until` and `trial_ends_at` columns moved off the users table into `billing.entitlements`
and the hand-written guard replaced by a pure state machine. FIRE's hard-coded prices and its access
script become plans in the config, a payment page and an admin page that grants a plan. Accounts
that exist when billing is turned on keep their access through a trial floor (`trial.startsAt`), an
import of what the old system knew (`import-entitlements`) and a pin step for derived trials
(`pin-trials`); see "Existing accounts" in §4.

## 1. What it provides

- **A pure state machine** (`resolveEntitlement`, `applyEntitlementEvent` from the root entry): a
  record (trial end, paid until, lifetime) and an instant give `trial | paid | read_only`, with the
  days left and whether the reminder window is open; an event (`grant`, `grant_lifetime`, `revoke`,
  `shorten`, `end_lifetime`, `extend_trial`, `import`) gives the next record. No database and no clock.
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
  grants the plan once it is paid. The request is stored in `billing.payment_requests` before it is
  handed over, reaches the owner once however often the buyer asks again, and stays until the
  admin grants or dismisses it or it expires (`expireStaleRequests`). **`grantPlanManually()`** grants and records a plan in
  `billing.manual_grants`; **`revokeManualGrant()`** takes back only what one grant added.
- **`stripe()`**, a card, BLIK and transfer adapter on Stripe Checkout (one-time payments), and
  **`stripeWebhookRoute`** (`/next`): a verified Stripe webhook that grants a paid checkout's plan
  and, on a refund, takes back what that one payment granted (a partial refund its share, by the
  `partialRefunds` policy), exactly once per payment, recorded in `billing.payments` (see
  "Refunds" below).
- **Reminder mail** (`@softure-ai/billing/mailing`): `sendAccessReminders(ctx)` mails every
  account whose trial or dated paid access is in its reminder window, or ended in the last few
  days, once per account and window through `@softure-ai/mailing`'s delivery ledger; the app runs
  it on a schedule (see "Reminder mail" in §4). `findAccessReminders` (`/server`) is the same list
  without mail, for an app that sends its own.
- **Plan scripts** (`@softure-ai/billing/scripts`): `grant-plan` and `revoke-grant`, ops scripts
  (dry run by default, `--commit` writes) for a host without the admin page; their grants are in
  the account's history like the admin page's (see "Scripts" in §4).
- **Existing accounts**: `trial.startsAt` gives accounts created before a chosen day a trial from
  that day; `import-entitlements` (`importEntitlement()` on the server) records the trial ends, paid
  periods and lifetime access another system knew, never shortening access; `pin-trials`
  (`pinDerivedTrials()`) writes every derived trial into a row before a config change would move it
  (see "Existing accounts" in §4).
- Export and deletion of the entitlement row, the payments, the invoice requests and the manual grants (`@softure-ai/privacy`), and a health check for
  `GET /api/health`.

## 2. Installation

```bash
npm install @softure-ai/billing @softure-ai/auth @softure-ai/security @softure-ai/core @softure-ai/db @softure-ai/ui drizzle-orm zod
```

Peer dependencies: `next` 16, `react` 19, `drizzle-orm`; `@softure-ai/mailing` (optional) for
`@softure-ai/billing/mailing`. The module depends on `security` and `auth`; a configuration without
them fails at startup.

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
| `trial.startsAt` | `YYYY-MM-DD` | — | The first day a trial can start, a local day in `config.timezone`: an account without a row created before it gets its `trial.days` from this day (see "Existing accounts" in §4). A day in the future keeps those accounts writing until it, plus `trial.days`. |
| `trial.reminderDays` | integer 0 to 365 | `3` | From how many days left the trial counts as ending (badge tone, notice). `0`: never. |
| `paid.reminderDays` | integer 0 to 365 | `7` | The same for dated paid access. Lifetime access never ends. |
| `plans` | array, at most 12 | `[]` | The plans, in the order the tiles show them (see below). |
| `payment` | `PaymentProvider` | — | The adapter the payment page uses: `stripe()` or `manual({ onRequest })`. The payment page throws without one. |
| `partialRefunds` | `"pro_rata"` or `"keep_access"` | `"pro_rata"` | What a partial provider refund does to access (see "Refunds" in §4): `pro_rata` takes back the refunded share of the payment's unused days, `keep_access` nothing until the whole payment is refunded. |
| `requests.expireAfterDays` | 1-365 | `30` | Days an open invoice request waits, counted from the buyer's last ask; `expireStaleRequests` (run daily, see "Invoice requests" in §4) then closes it as `expired` and clears its invoice details. |
| `adminRole` | role | `admin` | The auth role that may grant plans in `BillingAdminPage`; declare any other in `auth({ roles })`. A role auth does not declare fails the first billing request and the readiness probe. |
| `routes.payment` | path | `/payment` | Where `PaymentPage` is mounted; the notice and the tiles link there, and Stripe Checkout returns there. |
| `routes.admin` | path | `/admin/billing` | Where `BillingAdminPage` is mounted; its actions revalidate it, and the account lookup sends the admin there with `?account=<id>`. |
| `routes.webhook` | path | `/api/billing/webhook` | Where `stripeWebhookRoute` is mounted (the Stripe endpoint's URL). |
| `messages` | partial `en` / `pl` | — | Copy overrides. |

**A plan** is `{ id, name, description?, price: { amount, currency }, period, features?, isFeatured? }`:
`id` kebab-case and unique; `name`, `description` and each feature line a text per locale with at
least `en`; `amount` an integer in the currency's minor unit as `Intl` formats it (2900 is 29.00 PLN,
1500 is ¥1,500, 1500 is ISK 1,500, 1250 is KWD 1.250);
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

**Stripe's currency units.** Stripe takes amounts in its own unit per currency
([currency guide](https://docs.stripe.com/currencies)), which is not always `Intl`'s: ISK and UGX
(and e.g. ALL, RSD, LAK) have no decimals in `Intl` but two (always `00`) at Stripe. Plans stay in
`Intl`'s unit; `stripe()` converts what it sends (ISK 1,500 goes as `150000`) and the webhook converts
what Stripe reports back, so payments and refunds are stored and shown in the plan's unit. HUF and
TWD need nothing: Stripe's divisible-by-100 rule for them is for payouts, not charges. A price
`stripe()` cannot charge exactly is refused when the config loads, naming the plan: a three-decimal
amount (BHD, JOD, KWD, OMR, TND) whose last digit is not 0, or an `Intl` amount finer than Stripe's
unit (LYD). Stripe's minimum and maximum amounts depend on the account and the payment method, so
Stripe checks them at Checkout (`billing.payment_failed` and a log line).

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
| a checkout still waiting for a transfer, a charge with nothing refunded, any other event, a session billing did not create | nothing | 200 |
| `charge.refunded` with `refunded: true` for a stored payment | the payment is marked refunded and what it granted taken back, once | 200 |
| `charge.refunded` with `refunded: false` for a stored payment | `amount_refunded` (the total so far) is recorded and access follows `partialRefunds`; a total not above the stored one (a retry, a late delivery) changes nothing | 200 |
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
  `paid` or an active manual lifetime grant (`billing.manual_grants`) still gives it. Lifetime
  keeps the dated end beside it (a grant on lifetime still extends it), so the months bought next
  to a refunded lifetime stay.
- **A payment stored before grants were recorded** (no grant columns) revokes paid access, as
  before.

**Partial refunds.** A payment keeps the total refunded so far (`refunded_amount`, from Stripe's
cumulative `amount_refunded`) and stays `paid` until that total reaches its amount. Under
`partialRefunds: "pro_rata"` (the default) each partial refund takes back the share of the period's
unused days that the newly refunded money is of the money not refunded before, rounded down to
whole days (the account keeps a part of a day), and the payment's stored period ends that many days
earlier; the periods stacked after it move back too. Refunding 14.50 of a 29.00 month bought for 31
unused days takes back 15. The refund that completes the amount is a full refund, so partial refunds
that add up to the payment end exactly where one full refund at the time of the last one would.
Under `"keep_access"` (refunds as goodwill or compensation) a partial refund takes nothing back,
and the completing one takes back every unused day left. Either way a partial refund never ends a
lifetime nor revokes a payment stored before grants were recorded: only the completing refund does.

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
  asked for, the price it quoted and the invoice details (the latest ones: a buyer who asks again
  refreshes them without a new hand-over, so the owner's mail may hold older ones). **Grant** applies the plan and closes the request in one
  transaction (`grantPaymentRequest`); **Dismiss** closes it without a grant; **History** opens the
  account's history. A request is granted or dismissed once: a second click finds it closed.
- **Grant access**: a plan for the account with a given email, recorded like a request's grant.
  An account with lifetime access is refused (`billing.lifetime_active`): a dated period under
  lifetime would be invisible.
- **Account history**: the email lookup sends the admin to `?account=<id>` (no address in a URL),
  which shows the account's badge and its manual grants and provider payments, newest first, each
  with its price, the access it added and its state. **Revoke** on an active manual grant takes back only
  what it added, like a refund: a period loses its unused days and the periods stored after it
  (manual or paid) move back; a lifetime ends unless another active manual lifetime or a paid
  lifetime payment still gives it. Provider payments are refunded at the provider, not here.

**Invoice requests.** `startPayment` stores a manual request first, then claims its hand-over on
the row and calls `onRequest`; an open request is handed over once, and asking again only
refreshes its details, price and time. When `onRequest` answers an `Err` or throws, the claim is
released: the buyer sees `billing.payment_failed`, the admin page still lists the request, and the
next ask hands it over. Invoice details are refused with a code per field:
`billing.invoice_field_required`, `billing.invoice_field_too_long` (the copy names the limit:
200, 32, 500) or `billing.invoice_field_control_characters` (line breaks, tabs and other control
characters, in every field, so a name cannot add lines to the owner's mail; the database refuses
them too). Run `expireStaleRequests(ctx)` (`/server`) daily, like the reminder mail, to close
requests nobody asked again for in `requests.expireAfterDays` days; it returns `{ expired }`, and
a repeated run closes nothing new:

```ts
// scripts/expire-invoice-requests.ts (cron: 0 3 * * *)
import { expireStaleRequests } from "@softure-ai/billing/server";
import { systemClock } from "@softure-ai/core";
import { createDatabase } from "@softure-ai/db";
import config from "../softure.config.ts";

if (config.database === null) throw new Error("expire-invoice-requests: the config has no database");
const database = await createDatabase(config.database.url, { max: 1 });
try {
  console.log(JSON.stringify(await expireStaleRequests({ db: database.db, clock: systemClock, config })));
} finally {
  await database.close();
}
```

**Reminder mail.** With `mailing({ ... })` in the config, run `sendAccessReminders` on a schedule,
e.g. a daily cron job (or a platform scheduler) running a script:

```ts
// scripts/send-access-reminders.ts (cron: 0 9 * * *)
import { sendAccessReminders } from "@softure-ai/billing/mailing";
import { systemClock } from "@softure-ai/core";
import { createDatabase } from "@softure-ai/db";
import config from "../softure.config.ts";

if (config.database === null) throw new Error("send-access-reminders: the config has no database");
const database = await createDatabase(config.database.url, { max: 1 });
try {
  console.log(JSON.stringify(await sendAccessReminders({ db: database.db, clock: systemClock, config })));
} finally {
  await database.close();
}
```

Each run mails the four states the notice shows: the trial or dated paid access ending (from
`trial.reminderDays` / `paid.reminderDays` days left, "ends on {date}") and ended ("has ended",
from the day it ended through `catchUpDays` days after it, default 3, so turning reminders on never
mails accounts that lapsed long ago; an account created without a trial gets no "trial ended" mail).
Lifetime access gets nothing. The mail is transactional (no unsubscribe footer: it is an account
notice), in the app's locale, with the notice's link text and the absolute payment page URL. Each
account gets one mail per kind and end (scope `billing.<kind>:<account id>:<end>` in
`mailing.deliveries`): a run repeated the same day, or two runs at once, send nothing new, while an
extended trial or a renewal is a new window. Options: `catchUpDays` (0 to 365), `pauseMs` between two
mails the provider was called for (default 500, Resend's two requests per second). The summary counts
`due`, `sent`, `skipped` (sent by an earlier run, or another run is sending it), `rejected` (refused
for good) and `retryLater` (the provider was unavailable; the next run sends it). A database failure
throws; the next run resumes. Candidates come from two range queries, the stored ends and
`auth.users.created_at` (indexed by auth's `0004`) for accounts without a row, never a scan of every
account.

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
per account, checks the plan, lifetime access and the invoice details (`parseInvoiceDetails`, a zod
schema, `invoiceDetailsSchema` from the root entry), stores a request for a provider that hands
requests over and calls the provider once per open request (see "Invoice requests");
`expireStaleRequests(ctx)` closes requests older than `requests.expireAfterDays`; `findAccountByEmail(ctx, email)`,
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

**Scripts.** `@softure-ai/billing/scripts` builds ops scripts on `@softure-ai/ops/scripts` (dry run by
default, `--commit` writes, one transaction), for an operator without the admin page or at a
terminal: `grant-plan` and `revoke-grant` here, `import-entitlements` and `pin-trials` under
"Existing accounts" below. The app bundles them like its other scripts and runs them with its
database URL:

```ts
// scripts/grant-plan.ts: npm run grant-plan -- --email=member@example.com --plan=monthly [--commit]
import { createGrantPlanScript } from "@softure-ai/billing/scripts";
import { runOpsScript } from "@softure-ai/ops/scripts";
import config from "../softure.config";

process.exitCode = await runOpsScript({ script: createGrantPlanScript(config), argv: process.argv.slice(2), config });
```

- `grant-plan --email=… --plan=<plan id>` grants one payment of a declared plan through
  `grantPlanManually` (no admin: `granted_by` is null), so it is in the account's history and the
  admin page can revoke it. Refuses an undeclared plan (naming the declared ones), an unknown email
  and an account with lifetime access.
- `revoke-grant --email=… --grant=<id>` revokes one active manual grant of that account through
  `revokeManualGrant` (a script's or the admin page's) and takes back what it added. Refuses an
  unknown email and an id that is not an active manual grant of the account (another account's,
  revoked, mistyped).

Both print the account's state `before` and `after`: the user id (never the email), the
entitlement and the active manual grants with their ids, newest first; a dry run of either script
shows the id `revoke-grant` takes. `createGrantPlanScript(config, { clock? })` and
`createRevokeGrantScript(config, { clock? })` take a clock for tests (`executeOpsScript`).

**Existing accounts.** An account without a `billing.entitlements` row is on the trial derived from
its creation day (§5), so turning billing on for accounts that already exist would make every one
older than `trial.days` read-only at once. Three tools, in this order, keep their access:

1. **A trial floor**, `billing({ trial: { startsAt: "2026-11-01" } })`: every account created before
   that local day gets its `trial.days` from it, on every read, without a write; accounts created on
   or after it keep their own trial. The reminder mail sees the floored trials too, so all those
   accounts get their trial-ending mail in the same window.
2. **An import** of what the old system knew (FIRE_TRACKER's `trial_ends_at`, `paid_until`):

   ```ts
   // scripts/import-entitlements.ts: npm run import-entitlements -- --file=entitlements.json [--commit]
   import { createImportEntitlementsScript } from "@softure-ai/billing/scripts";
   import { runOpsScript } from "@softure-ai/ops/scripts";
   import config from "../softure.config";

   process.exitCode = await runOpsScript({ script: createImportEntitlementsScript(config), argv: process.argv.slice(2), config });
   ```

   The file (its path relative to the working directory) is a JSON array, at most 50,000 rows:

   ```json
   [
     { "email": "ada@example.com", "trialEndsAt": "2026-08-15T00:00:00+02:00", "paidUntil": "2027-01-01T00:00:00+01:00" },
     { "email": "grace@example.com", "isLifetime": true }
   ]
   ```

   Each row needs `email` and at least one of `trialEndsAt`, `paidUntil` (ISO 8601 with an offset,
   the first instant without access, as `billing.entitlements` stores it; `null` for none) and
   `isLifetime`. Each is merged onto the account's current record (its row, or its derived and
   floored trial) by the `import` event: an end only moves later, lifetime only turns on, so an
   import never takes access away and running the same file again changes nothing. An imported end
   earlier than the account's own is therefore not recorded; past ends later than it are (an ended
   paid period shows as `paid_ended`). The import is not a grant: it is not in the account's history
   and is not revocable from the admin page (correct a mistake with `changeEntitlement`'s `revoke` or
   `shorten`). The whole file is one transaction and refused as a whole for a file that cannot be
   read, a row that fails the format, an email repeated in the file (compared as auth stores emails)
   or an email no account has; refusals name row numbers, never emails. The report counts the named
   accounts by state (`trial`, `paid`, `lifetime`, `readOnly`) `before` and `after`. Split a very
   large file: every row takes its locks until the end of the run. `importEntitlement(ctx, { userId,
   trialEndsAt?, paidUntil?, isLifetime? })` (`/server`) is the same merge for an app that migrates in
   its own code; it returns the `Entitlement` or `Err<billing.account_unknown>`.
3. **A pin** before any change of `trial.days`, `trial.startsAt` or `config.timezone`:
   `npm run pin-trials [-- --commit]` (`createPinTrialsScript(config)`, no arguments) writes the trial
   every account without a row is on, exactly as reads derive it, into a row, so the change moves no
   existing trial and applies to new accounts only. Rows written meanwhile by a change are kept; a
   second run pins nothing. The report gives `accountsWithoutRow` `before` and `after`, and `pinned`.
   `pinDerivedTrials(ctx)` (`/server`) is the same step, returning how many rows it wrote.

Both scripts take `{ clock? }` for tests, like the plan scripts.

**A payment provider** (`PaymentProvider` from the root entry) has a `name`, says whether the page
collects invoice details (`collectsInvoiceDetails`) and whether it hands requests to the owner
instead of sending the buyer to a checkout (`handsOverRequests`: billing then stores the request
before the call and makes the call once per open request), and implements
`startPayment(ctx, { plan, account, invoice, returnUrl })`, which resolves with
`{ type: "redirect", url }` (a hosted checkout; the action redirects there), `{ type: "requested" }`
(handed over, only for `handsOverRequests: true`; the page confirms) or
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
derived from `auth.users.created_at`, `trial.days`, `trial.startsAt` and `config.timezone`, and
auth's single `onRegistered` hook stays free for the app. Accounts created before billing was
enabled are on that derived trial too, so without `trial.startsAt` or an import those older than
`trial.days` are read-only from the first read (see "Existing accounts" in §4). The first change
(`changeEntitlement`, an import, `pin-trials`) stores the derived trial end with the event applied,
so the trial end never moves when a row appears. Until then every read derives it again, so for
accounts without a row:

| Config change | Effect |
| --- | --- |
| shorter `trial.days` | every derived trial ends earlier: accounts past the new end are read-only at once |
| longer `trial.days` | every derived trial ends later: accounts whose trial had ended can write again |
| `trial.startsAt` set, moved or removed | the trial of every account created before the (old or new) floor day moves with it |
| `config.timezone` | every derived trial ends at the start of the same local day in the new zone, hours earlier or later |

Run `pin-trials` before such a change to keep existing trials where they are.

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
| `grant_kind`, `granted_from`, `granted_until` | What the payment granted (`0003`): `period` with its start and end, or `lifetime` with no dates; all NULL for rows recorded before. A CHECK (`payments_grant_shape`) ties the dates to the kind. A partial refund moves `granted_until` back by the days it took. |
| `refunded_amount` | The total refunded so far, in the currency's minor unit (`0005`): `amount` once `refunded`, below it while `paid` (CHECK `payments_refunded_amount_by_status`). |

`migrations/0003_record_payment_grants.sql` adds the grant columns and drops the CHECK that kept
`paid_until` NULL under lifetime. `migrations/0005_record_refunded_amounts.sql` adds
`refunded_amount` (set to `amount` on payments refunded before).
`migrations/0006_record_request_handover_and_prices.sql` adds `handed_over_at` (set to
`requested_at` on open requests, which were all handed over), the price columns of both manual
tables, the `expired` status and the control-character CHECKs.

The insert, the grant and its grant columns share a transaction, as do the refund's conditional update and the change it makes,
so a delivery seen twice changes nothing. Every write takes the account first (like the privacy
erase); a refund and a manual revoke then take the entitlement before their own row, since moving
the later periods back updates other rows under that lock.

`migrations/0004_create_requests_and_grants.sql` creates the manual payments' two tables:

`billing.payment_requests`, one row per invoice request:

| Column | Meaning |
| --- | --- |
| `id`, `user_id`, `plan_id` | The request, its account (`ON DELETE CASCADE`) and the plan asked for. |
| `invoice_name`, `invoice_tax_id`, `invoice_address` | The details as typed, kept **only while the request is open**: closing it clears them (CHECK `payment_requests_details_while_open`). No control characters in new values (`0006`, CHECKs `payment_requests_invoice_*_printable`, `NOT VALID`: older rows are not rewritten). |
| `status`, `requested_at`, `closed_at` | `open`, `granted`, `dismissed` or `expired` (`0006`); a CHECK ties `closed_at` to the status. `requested_at` is the last ask. |
| `handed_over_at` | When the hand-over to the owner was claimed (`0006`); NULL while it was not handed over (or failed and was released). |
| `amount`, `currency` | The plan's price at the last ask, in the currency's minor unit (`0006`); NULL on rows stored before. |

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
| `amount`, `currency` | What it was granted for (`0006`): the price its request quoted, else the plan's price when granted; NULL on rows stored before. |

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
`featured`, `choose`, `empty`), `reminderMail` (`subject` and `body` of `trialEnding`,
`paidEnding`, `trialEnded` and `paidEnded`; the link text is the notice's), `payment` (the payment page, the invoice form and the notices after a
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
  `refundedAt`, `refundedAmount`, `grantKind`, `grantedFrom`, `grantedUntil`), its invoice requests (`planId`, the
  invoice details while open, `amount`, `currency`, `status`, `requestedAt`, `closedAt`) and the
  plans granted to it by hand (`planId`, `grantedAt`, the grant, `status`, `revokedAt`, `amount`,
  `currency`). Which admin granted or revoked
  is the admin's data and stays out of the account's export.
- Deletion: the row, the payments, the requests and the manual grants, and the foreign keys remove
  them with the account too; an erased admin's id is cleared from the grants they made.
  Stripe keeps its own record of each payment (the controller's accounting record there).
- Reminder mail: what was sent is in `mailing.deliveries` under a recipient key (never the
  address) and a scope naming the account id and the end; mailing keeps that ledger after an account
  is deleted (see its README §11), when the id no longer points at anyone.
- Retention: invoice details are personal data the app needs only until the request is handled,
  so granting or dismissing it erases them, and `expireStaleRequests` erases them from a request
  nobody asked again for in `requests.expireAfterDays` days (30 by default). What `onRequest` delivered (the mail to the owner) and
  the issued invoice are the app's and the owner's own records.

## 12. Limitations

- A refund that reaches the app before its checkout (Stripe does not order events) finds no
  payment and is not retried.
- A refund that fails after Stripe reported it (`refund.failed`, the bank or card refuses it)
  lowers Stripe's `amount_refunded` again, but billing keeps what it took back and the payment
  stays refunded (followups FU-30). The charge's currency is not compared with the payment's: a
  Checkout payment has one charge, in the session's currency.
- A dated manual grant keeps its length when a refund or a revoke takes back another period.
- A refund of a period moves the dated end back by local days; a `grant { until }` an app applies
  by hand with an end inside the stack is not a period of its own and shifts with it.
- A payment recorded before migration `0003` has no grant: its refund revokes all paid access.
- The Stripe adapter is tested against the sandbox's Checkout API (when `STRIPE_SECRET_KEY` holds a
  test key) and with signed webhook fixtures; a browser payment end to end in the sandbox is
  item LT-1 of the later roadmap (`context/foundation/roadmaps/roadmap-later.md`).
- A grant through `grantPlan` (or a raw `changeEntitlement`, an import) is not recorded: it is not
  in the history and cannot be revoked; the `grant-plan` script records its grants.
- The owner hears of an open request once: a buyer who corrects the details later changes the
  admin page, not the mail already sent. Two asks at once for the same plan hand over once; if that
  hand-over fails, the other ask has already answered "sent", and the next ask retries.
- A hand-over that crashes the process after its claim and before `onRequest` returns stays
  claimed: the admin page lists the request, but the owner's mail may not have gone out (followups FU-34).
- The admin page lists up to 50 open requests and 100 entries of each source in a history; there
  is no paging.
- The write guard is per action: a read-only account can still call a write the app did not guard.
- Reminder mail is plain text with a minimal HTML body; there is no app template for it, and it
  uses the app's locale (accounts have none of their own).
- No history of entitlement changes beyond grants: a row holds the current state; provider
  payments and manual grants are stored, trial extensions and raw events are not.
