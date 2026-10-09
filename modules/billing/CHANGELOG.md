# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/billing`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`billing@x.y.z`).

## 0.1.11

- `BILLING_RATE_LIMIT_BUCKETS` declares `key: "account"` on `billing-payment` (security 0.1.8 bucket kinds).
- Requires `@softure-ai/security` `^0.1.8`: earlier versions refuse the `key` field.

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
