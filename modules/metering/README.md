# @softure-ai/metering

A ledger of paid provider calls in the provider's own unit, and budgets that refuse a call before it spends.

## 1. What it provides

- `metering.charges`: every paid call an app makes (speech and audio credits, images, search requests, model dollars),
  with provider, step, unit, amount, account and the app's attributes.
- Budgets per provider and day or month, for the whole provider or per account, in the provider's unit.
- `reserveSpend` before a paid call, `settleSpend` with the billed amount after it, `releaseSpend` when it failed
  unbilled. A reservation runs in one transaction under the provider's lock, so two jobs reserving at once cannot both
  pass the same remaining amount. Amounts compare as Postgres `numeric`, so `0.1 + 0.2` fills a `0.3` budget exactly.
- `recordCharge` for spend reported after the fact, `getSpend` for a status tool or page, `getSpendBreakdown` for
  spend per step or per item (any attribute), and an attribute `filter` for one item's cost.
- Adapters for `@softure-ai/llm`'s `onUsage` and `@softure-ai/marketing-kit`'s footage `onCharge`, a GDPR contributor
  and a prune job for `@softure-ai/jobs`.

## 2. Installation

```bash
npm install @softure-ai/metering
```

`@softure-ai/jobs` is an optional peer: only the `@softure-ai/metering/jobs` entry needs it.

## 3. Configuration

```ts
// softure.config.ts
import { metering } from "@softure-ai/metering";

metering({
  providers: [
    // 100,000 credits a month for the app, 2,000 a day for each account.
    { id: "elevenlabs", unit: "credits", budgets: [{ period: "month", limit: 100_000 }, { period: "day", limit: 2_000, perAccount: true }] },
    { id: "openrouter", unit: "usd", budgets: [{ period: "day", limit: 5 }] },
    // Metered, no budget.
    { id: "brave-search", unit: "requests" },
  ],
  reservationTtlSeconds: 3600, // default
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| `providers[].id` | required | Lower case words joined by `.`, `_` or `-`, at most 64 characters. |
| `providers[].unit` | required | `credits`, `usd`, `characters`, `seconds`, `tokens` or `requests`. Every amount of the provider is in it. |
| `providers[].budgets[]` | `[]` | `{ period: "day" \| "month", limit, perAccount = false }`; one budget per period and scope. |
| `reservationTtlSeconds` | `3600` | How long an unsettled reservation holds budget (a call that crashed). Longer than the slowest call. |

Days and months start at midnight in the app's `timezone` (`defineSoftureConfig`). Spend counts in the period it was
reserved or recorded in, also when it is settled later.

Using it around a paid call (`@softure-ai/metering/server`):

```ts
const reserved = await reserveSpend(ctx, { provider: "elevenlabs", amount: estimate, step: "isolate", accountId, attributes: { jobId } });
if (!reserved.ok) return reserved; // metering.budget_exceeded, with reserved.budget.remaining and reserved.budget.resetsAt
try {
  const result = await callProvider();
  await settleSpend(ctx, reserved.value, result.creditsBilled);
  return ok(result);
} catch (error) {
  await releaseSpend(ctx, reserved.value); // only when the provider did not bill
  throw error;
}
```

| Function | Returns |
| --- | --- |
| `reserveSpend(ctx, { provider, amount, step?, accountId?, attributes? })` | `ok(SpendReservation)` or `BudgetExceeded` (`error: "metering.budget_exceeded"`, `budget`, `requested`). |
| `settleSpend(ctx, reservation, actual)` | `ok()` or `metering.reservation_not_found` (settled, released or pruned). An actual above the reservation is recorded as billed. |
| `releaseSpend(ctx, reservation)` | `ok()` or `metering.reservation_not_found`. |
| `recordCharge(ctx, { provider, amount, step?, accountId?, attributes?, at? })` | `ok({ id })`; never refused, the spend already happened. |
| `getSpend(ctx, { provider, period, accountId?, filter? })` | `ok(SpendSummary)`: `settled`, `reserved`, `spent`, `limit`, `remaining`, `from`, `resetsAt`. With `accountId`: that account's spend and its per-account budget. With `filter: { attribute, value }`: only the charges with that attribute value; `limit` and `remaining` stay the scope's budget. |
| `getSpendBreakdown(ctx, { provider, period, accountId?, groupBy, filter? })` | `ok(SpendBreakdown)`: `rows` of `{ key, settled, reserved, spent }` per `step` (`groupBy: "step"`) or per attribute value (`groupBy: { attribute }`), highest spend first. `key: null` gathers charges without the step or attribute, so the rows add up to `getSpend`. |

`BudgetExceeded.budget` names the first budget the amount did not fit: `scope` (`{ kind: "provider" }` or
`{ kind: "account", accountId }`), `period`, `limit`, `spent`, `remaining` and `resetsAt`. An undeclared provider, an
amount that is negative, not finite or above `1e15`, and a reservation without `accountId` for a provider with a
per-account budget throw: they are bugs, not expected failures. So does an attribute name that is empty or longer
than 100 characters, and a filter value that is empty or longer than 500.

### Spend per step and per item

```ts
import { getSpend, getSpendBreakdown } from "@softure-ai/metering/server";

// This month per item (charges recorded with attributes: { jobId }) and per step.
const perItem = await getSpendBreakdown(ctx, { provider: "elevenlabs", period: "month", groupBy: { attribute: "jobId" } });
const perStep = await getSpendBreakdown(ctx, { provider: "elevenlabs", period: "month", groupBy: "step" });
// One item: its total, and its steps.
const item = await getSpend(ctx, { provider: "elevenlabs", period: "month", filter: { attribute: "jobId", value: jobId } });
const itemSteps = await getSpendBreakdown(ctx, { provider: "elevenlabs", period: "month", groupBy: "step", filter: { attribute: "jobId", value: jobId } });
```

The period bounds and the rule for what counts (settled charges and unexpired reservations) are the same as
`getSpend`'s. A filter matches the attribute's value exactly, through `attributes @> {attribute: value}`, which the
`charges_attributes_idx` GIN index serves for any attribute name, so one item's spend stays an index lookup on a page
of a few hundred items. Grouping reads one provider's period through the `(provider, created_at)` index.

## 4. Mounting

Nothing to mount. A status page or tool reads `getSpend` and `getSpendBreakdown`.

## 5. Migrations and tables

Schema `metering`, migrations `0001_create_charges.sql` and `0002_index_charge_attributes.sql` (a GIN index on
`attributes` for filters), table `charges`:

| Column | Meaning |
| --- | --- |
| `id` | uuid |
| `provider`, `unit` | the declared provider and its unit |
| `step` | what the call was for (nullable) |
| `amount` | `numeric(24, 8)`, at least 0 |
| `account_id` | the app's account or user id (nullable) |
| `attributes` | the app's string attributes, a JSON object |
| `status` | `reserved` (with `expires_at`) or `settled` (with `settled_at`) |
| `created_at` | when the spend was reserved or recorded: the period it counts in |

## 6. Environment variables

None.

## 7. Switches

None.

## 8. Appearance

No UI.

## 9. Copy

`src/messages/en.ts` holds `errors["metering.budget_exceeded"]` and `errors["metering.reservation_not_found"]`;
`getMeteringErrorMessage(code, messages?)` reads them, and an app passes its own dictionary for other languages.

## 10. Hooks

Adapters (`@softure-ai/metering/server`) read the other packages' records by shape, so metering depends on neither.

- **`@softure-ai/llm`:** `createLlm({ ..., onUsage: createLlmUsageRecorder(ctx, { provider: "openrouter" }) })`
  records each priced call as a `usd` charge (a call with `costUsd: null` records nothing). The record's `accountId`
  attribute becomes the charge's account; the model is the step and an attribute. The provider must be declared with
  unit `usd`. A failed write propagates through `onUsage`. `recordLlmUsage(ctx, record, options)` does one record.
- **marketing-kit footage:** `onCharge` is synchronous, so the recorder runs the writes in the background and
  `flush()` reports them:

  ```ts
  const recorder = createFootageChargeRecorder(ctx, { accountId, attributes: { filmId }, creditsPerSecond: 15 });
  await transcribeFootage(film, clips, { ...runOptions, onCharge: recorder.onCharge }); // and the other paid steps
  await recorder.flush(); // rejects with the first failed write
  ```

  A provider billed in `seconds` records the charge's seconds; one billed in `credits` records the reported credits,
  or `creditsPerSecond` times the seconds when the provider reports none (without a rate that charge fails).
- **Prune job** (`@softure-ai/metering/jobs`): `jobs({ schedules: { ...createMeteringJobSchedules({ keepDays: 400 }) } })`
  and `handlers: { ...meteringJobHandlers }`. Daily, it deletes charges older than `keepDays` (at least 32, so a month
  budget never loses its own period) and expired reservations. `pruneCharges(ctx, { keepDays })` runs it directly.

## 11. GDPR

The module contributes to `@softure-ai/privacy` through `account_id`: an app that meters per user passes the user id
as `accountId`. The export lists the user's charges (provider, step, unit, amount, status, attributes, time). A
deletion clears `account_id` and `attributes` and keeps the amounts, so budgets and spend totals stay true; the
charges are the app's records of what it paid. `exportMeteringUserData` and `deleteMeteringUserData` take `{ db }` for
an app that runs its own deletion transaction.

## 12. Limitations

- One lock per provider: reservations of one provider run one at a time (the check is two indexed sums and an insert).
- A reservation that outlives `reservationTtlSeconds` stops holding budget, and once pruned it cannot be settled
  (`metering.reservation_not_found`); record the late charge with `recordCharge` then.
- Spend over a budget is possible through `recordCharge` and a settle above the reservation: the ledger records what
  was billed. `remaining` is then 0.
- No currency conversion: a budget is in its provider's unit only, and `usd` is the only money unit.
- No UI or route: the app builds its own status page on `getSpend` and `getSpendBreakdown`.

## Build

`npm run build -w modules/metering` runs `tsc -p tsconfig.build.json`. Releasing:
[scripts/release/README.md](../../scripts/release/README.md).
