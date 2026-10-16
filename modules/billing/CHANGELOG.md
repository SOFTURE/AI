# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/billing`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`billing@x.y.z`).

## 0.6.0

- **Lifetime access without a lifetime plan** (#539): an app whose plans are all dated can still grant lifetime
  access, e.g. to its owner's own account or a complimentary one. `grantLifetimeManually(ctx, { userId, adminId })`
  (`/server`) grants it and records it in `billing.manual_grants` under `LIFETIME_GRANT_PLAN_ID` (`"_lifetime"`, root
  export) without a price, so the admin page's history lists it ("Lifetime access, granted by hand") and revokes it
  like any manual grant. The admin page's "Grant access" form always offers **Lifetime access, free of charge** after
  the plans (also with no plans declared), and the new ops script `grant-lifetime --email=… [--commit]`
  (`createGrantLifetimeScript`, `@softure-ai/billing/scripts`) does the same from a terminal or `deploy.sh run`. New
  messages `admin.grantedLifetime` and `admin.lifetimeOption`; `admin.noPlans` now says lifetime access needs no
  plan. No migration.
  Migrate (optional), for an app that wrote its own script around `changeEntitlement(ctx, userId, { type:
  "grant_lifetime" })`: replace it with `grant-lifetime`. Lifetime access granted by that script stays as it is; it
  is still not in the history.

## 0.5.0

- `@softure-ai/billing/jobs` (#490): `billingJobHandlers`, `createBillingJobHandlers({ reminders })` and
  `billingJobSchedules` run `sendAccessReminders` (`billing.access-reminders`) and `expireStaleRequests`
  (`billing.expire-requests`) as daily `@softure-ai/jobs` schedules (00:00 UTC). A reminder run that meets a mail
  outage (`mailing.unavailable`) is retried with the queue's backoff without mailing anyone twice; a refused sending
  account or a spent quota fails the job, and the next day's run resumes. `@softure-ai/jobs` (^0.1.1) is a new
  optional peer; the plain functions are unchanged, so an app without jobs keeps its cron.
  Migrate (optional), for an app that runs `scripts/send-access-reminders.ts` and `scripts/expire-invoice-requests.ts`
  from a cron today:
  1. Install `@softure-ai/jobs` 0.1.1 or later and set up its worker (jobs README, "Running the worker"; with
     `@softure-ai/deploy`, `softure-deploy init` adds it).
  2. In `softure.config.ts`, add `...billingJobSchedules` to `jobs({ schedules })` (from `@softure-ai/billing/jobs`).
     Without `mailing()` in the config, add only `"billing.expire-requests"`.
  3. In the worker's handlers, add `...billingJobHandlers`, or `...createBillingJobHandlers({ reminders: { ... } })`
     with the options the reminder script passed to `sendAccessReminders` (`buildMail`, `getScope`, `limit`,
     `catchUpDays`, `pauseMs`). Keep `getScope` as it is, so accounts already mailed are not mailed again.
  4. Deploy the worker, check that both queues run once (`getQueueStats`: `schedule.lastSucceededAt` is set), then
     remove the two cron entries and delete both scripts. Running both for a day is harmless: the delivery ledger
     sends each reminder once and a second expiry closes nothing new.

## 0.4.0

- **Usage limits** (#474): `trial.limits`, `paid.limits`, `readOnly.limits` and `plans[].limits` declare a
  limit per meter (`{ "ai-calls": 100 }`, `null` for none) per calendar month in `config.timezone`. `getLimits(ctx,
  userId)` (`/server`) answers `{ status, planId, limits }`: the plan paying for today comes from the recorded grants
  (provider payments, manual grants), `paid.limits` covers paid access none explains. `consumeUsage(ctx, { userId,
  meter, amount })` counts usage in the new `billing.usage` table and returns `Ok({ used, limit, remaining,
  periodStart, resetsAt })` or `billing.quota_exhausted` (with `usage`), atomically under concurrency and inside the
  app's own transaction when given one; `getUsage` reads without consuming. New root helpers `getUsagePeriod`,
  `resolveLimit`, `resolveLimits`, `getDeclaredMeters`; new message `errors.billing.quota_exhausted`. GDPR export
  and deletion cover the ledger; the readiness probe checks the table.
- Migration `0011_create_usage.sql` (run `softure migrate`). Options and existing calls are unchanged.
- Migrate an app that counts usage itself: declare its limits in `billing({ ... })` instead of its own constants;
  replace "count, compare, insert under its own lock" with `consumeUsage({ ...ctx, db: tx }, { userId, meter })`
  inside the transaction of the write it limits, returning early on `billing.quota_exhausted`; show
  `usage.resetsAt` (or `getUsage`) where it showed its own month end. To keep this month's count, insert one
  `billing.usage` row per account and meter (`period = 'month'`, `period_start` = the start of the month from
  `getUsagePeriod(now, timezone, "month").start`, `used` = its count) before the switch, then drop its own table.

## 0.3.0

- **Breaking (#446):** the built-in `pl` dictionary is gone; English is the only built-in copy and the fallback for
  every other locale, which is now any BCP 47 tag. Migrate: an app that shows Polish keeps its own translation and
  passes it as the overrides for its locale, `billing({ messages: { pl: myTranslation } })`; a key it leaves out reads
  English. Plan texts (`LocalizedText`) take any locale key and fall back to the locale's language, then `en`.
- `sendAccessReminders`' `buildMail` may return a plain-text mail: it returns `AccessReminderTemplateMail` (`subject`,
  `text` and an optional `html`, exported from `@softure-ai/billing/mailing`), and a mail without `html` reaches the
  provider with no HTML body. The package's own mail (`renderAccessReminderMail`, the template's `mail`) keeps its
  HTML body (#428).
- `AccessBadge` / `CurrentAccessBadge` take `texts` (the app's own text per kind, from the entitlement, the days
  left and the badge's text), `variant` (`full`, `short`, or `responsive`: short below `md`), `srPrefix` (a
  screen-reader label before the text) and `toneScope` (`pill` colours all the pill's text). The root always
  carries `data-kind` and `data-tone`; new slots `full`, `short`, `prefix`. Defaults render as before (#426).
- README: the client forms follow `UiLocaleProvider` when given no `locale` (they forward it to the ui fields, which
  read the provider); server components keep the prop (#435).

## 0.2.1

- The `@softure-ai/ui` peer range also accepts 0.2.0.

## 0.2.0

- `AccessReminderDue.endsAtMicros` (`findAccessReminders`, `sendAccessReminders`' `buildMail` and `getScope`): the
  end exactly as stored, in microseconds since the epoch as a decimal string (`endsAt` is a `Date` and drops them),
  equal to `(extract(epoch from <column>) * 1000000)::bigint::text`. An app whose own job built its scope in SQL
  rebuilds it in `getScope`, so an account with a non-zero microsecond end is not mailed twice (#388). The default
  scope is unchanged.
- `sendAccessReminders` is a `runDeliveries` run of `@softure-ai/mailing`: new options `dryRun`, `limit`,
  `retakeUncertain`, `onDelivery`, `stopOnRetryLater` and the claim windows (`pauseMs` still defaults to 500).
  **Breaking:** the summary is `runDeliveries`' `DeliveryRunSummary` plus `due`: `rejected` is counted by reason,
  `skipped` counts only a template's null, and what 0.1.11 counted there is now `done`, `inFlight` or `uncertain`;
  a stop is reported in `halted` (`remaining: null`). The run now stops at the first mail the provider could not
  take (pass `stopOnRetryLater: false` for the old behaviour) (#388).
- Requires `@softure-ai/mailing` `^0.1.12` (`runDeliveries`); stopping at the first `retry-later` needs its next
  release.

## 0.1.11

- `formatPrice` is core's `formatMoney`: thousands are always grouped, so a four-digit amount in pl reads
  `1 234,56 €` (was `1234,56 €`); en and amounts below 1000 are unchanged (#312).
- Plan periods, `parseDay` and the `/ui` day formatters use core's day arithmetic and `formatCalendarDay`; the
  results are the same. `CURRENCY_MINOR_UNIT_DIGITS` is core's table, still exported here. Requires
  `@softure-ai/core` `^0.1.9`.
- `BILLING_RATE_LIMIT_BUCKETS` declares `key: "account"` on `billing-payment` (security 0.1.8 bucket kinds).
- Requires `@softure-ai/security` `^0.1.8`: earlier versions refuse the `key` field.
- `sendAccessReminders(ctx, { buildMail, getScope })` (`/mailing`): `buildMail({ reminder, lastDay, link, mail })`
  returns the app's own mail (sync or async), or `null` to send that account nothing this run (counted in
  `skipped`); `getScope(reminder)` replaces the delivery scope, so an app moving from its own job keeps the
  ledger entries that job wrote. New type `AccessReminderMailContext`. Without them the mail and scope are as
  in 0.1.10 (#323).
- `entitlement-status` ops script (`createEntitlementStatusScript` in `/scripts`): `--email` or `--user`; prints
  `{ userId, state, trialLastDay, paidLastDay, isLifetime, access }` with the last days in the app's time zone,
  never the email, and writes nothing, also with `--commit` (#323).
- `AccessBadge` and `CurrentAccessBadge`: `unlimitedAfterDays` reads trial or dated paid access with more days
  left as "Unlimited access" (new message `badge.unlimited`, `data-unlimited="true"`); `compact` writes "5 days"
  and the numeric last day; `tones` sets the colour per kind. New `getAccessBadgeKind`, `AccessBadgeKind`,
  `AccessTone` (`/ui`). `AccessNotice` and `CurrentAccessNotice` take `tones={{ ending, ended }}` (`neutral` or
  `danger`, new type `AccessNoticeTone`) for the frame. Without the new props both render as in 0.1.10 (#323).

## 0.1.10

- `formatDayCount(days, locale, messages)` (`/ui`): a bare count of days for the app's own sentences ("5 days",
  "Trial ends in 5 days"), from a new plural table `messages.dayCount`, overridable like any message. The count is
  written in the locale's digits (a fraction reads with a comma in pl).
- `formatShortDay` and `formatShortLastDay` (`/ui`): the numeric forms of `formatDay` and `formatLastDay`
  (`22.11.2026` in pl, `11/22/2026` in en) for compact places such as a badge.
- `getBillingMessages(config)` is exported from `/next` too: the copy in the app's locale with its
  `billing({ messages })` overrides merged over the defaults.
- Existing copy, components and formatters render as in 0.1.9.
- Calendar days (trial ends, days left) are counted with `toCalendarDay` from `@softure-ai/core` instead of a local
  `en-CA` formatter. Same results; requires `@softure-ai/core` `^0.1.7` (#270).

## 0.1.9

- `extend-trial` ops script (`createExtendTrialScript` in `/scripts`): `--email` or `--user`, and `--until=YYYY-MM-DD`
  (the new last day) or `--days=N` (days of access after the current last day, or from today for an ended trial); dry run by
  default, `--commit` writes through `extendTrialManually` with no admin, so the extension is in the account's history.
- Fix: extending the trial of an account that had no entitlement row could fail on the database's
  `entitlements_updated_after_created` check, because the row was pinned with a later reading of the clock than the
  extension that updated it. The pin now takes the change's own instant (also for a manual grant).
- `PaymentPage` and `BillingAdminPage` take `lead`: one paragraph right after the `<h1>`. None by default, so pages
  render as in 0.1.8.

## 0.1.8

- `BillingAdminPage` has an "Extend a trial" card: the account's email and the trial's new last day.
  `extendTrialAction` (`/next`) and `extendTrialManually(ctx, { userId, until, adminId })` (`/server`) move the
  trial end later without writing `paid_until`, and record it in the new `billing.trial_extensions`, listed in the
  account's history (`AccountHistoryEntry` source `trial`). New codes `billing.trial_not_extended` and
  `billing.day_invalid`; new `TrialForm` (`/ui`), `TrialFormState`, `TrialFormErrorCode`, `TrialExtensionErrorCode`.
- `importEntitlement(ctx, { ...input, mode: "replace" })` and `import-entitlements --exact` store what the old system
  knew exactly, a trial shorter than the derived one included, for accounts that have no entitlement row yet; a
  different existing row is `billing.entitlement_exists` (the script refuses the whole file), the same one is a
  no-op. The default merge is unchanged.
- `PaymentPage` and `BillingAdminPage` render an `<h1>` first in their `<main>` (messages `payment.heading`,
  `admin.heading`); `heading` replaces it, `heading={null}` leaves it out for an app whose frame has its own.
- Migration `0010`: `billing.trial_extensions`, and indexes behind the foreign keys `payment_requests.user_id`,
  `manual_grants.granted_by` and `manual_grants.revoked_by`. Run `softure migrate`.
- The privacy export carries `trialExtensions` (`extendedAt`, `previousEndsAt`, `endsAt`); deletion erases them.

## 0.1.7

- `sendAccessReminders` stops at a refused mail account or a spent quota (mailing's `halted`, counted in
  `retryLater`) and skips a reminder whose send was interrupted long ago (mailing's `uncertain`, counted in `skipped`).

## 0.1.6

- `module.json` names `mailing` and `ops` as optional dependencies.
- Adapters and commands use the configured database handle; `@softure-ai/ui` is a peer dependency.
