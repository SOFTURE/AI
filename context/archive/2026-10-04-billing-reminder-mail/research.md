# Research: billing-reminder-mail

Input: change.md, roadmap FU-6, `docs/02-module-standard.md`. Depth: normal (no money moves, no
data migration beyond one index; mail is sent at most once through an existing ledger).
Snapshot: eaa4135 on claude/fu-6-3xpjg4, 2026-10-04 01:10 UTC.

## Summary

- Billing already computes the reminder window: `resolveEntitlement` returns `isEnding` from
  `trial.reminderDays` / `paid.reminderDays` and `read_only` with `since` and `reason`
  (`modules/billing/src/entitlement.ts:21-33`). The mail can reuse it unchanged, per candidate.
- Mailing's `deliverOnce(ctx, { scope, mail })` (`modules/mailing/src/server/deliveries.ts:60`) is
  the exactly-once primitive: one row per scope and recipient, a fenced claim, `retry-later` on a
  provider outage. A scope that names the account, the kind and the end day makes "once per window".
- Billing does not depend on mailing today (`modules/billing/package.json`, `module.json`). Auth
  has the precedent for an optional mail integration: a separate `./mailing` entry and
  `@softure-ai/mailing` as an optional peer dependency (`modules/auth/package.json:76-86`,
  `modules/auth/src/mailing/reset-mail.ts`).
- Candidates can be found with two range queries on end instants (stored rows) and on
  `auth.users.created_at` (accounts without a row, whose trial end is a function of that day).
  `auth.users.created_at` has no index (`modules/auth/migrations/0001_create_users_and_sessions.sql`).
- The roadmap's owner assessment fixes the trigger: billing ships a run function, the app
  schedules it (`context/foundation/roadmap.md`, "Owner at the keyboard?", FU-6).

## Current state

- **Records.** `findEntitlementRecord` (`modules/billing/src/server/entitlements.ts:24-40`) left-joins
  `auth.users` with `billing.entitlements`; without a row the record is
  `getDefaultRecord(created_at)`: `trialEndsAt = getTrialEnd(createdAt, trial.days, timezone)`,
  `paidUntil null`, `isLifetime false` (`entitlements.ts:18-21`). `getTrialEnd` is
  `getStartOfDay(getDayNumber(start) + days)` (`modules/billing/src/calendar.ts:84-86`).
- **States.** `resolveEntitlement` (`entitlement.ts:21-33`): lifetime → paid without end; dated paid
  before `paidUntil` → `paid` with `daysLeft` and `isEnding = daysLeft <= paidReminderDays`; else
  trial before `trialEndsAt` → `trial` with `isEnding` likewise; else `read_only` with `since` =
  `paidUntil` (`paid_ended`, when it outlasted the trial) or `trialEndsAt` (`trial_ended`).
  `getDaysLeft` counts local days, today included (`calendar.ts:92-94`).
- **The notice** shows exactly these four states (`messages/en.ts` `notice.trialEnding`,
  `paidEnding`, `trialEnded`, `paidEnded`) with `{date}` = last day with access
  (`modules/billing/src/ui/format.ts:8-10`, `formatLastDay`) and a link to `routes.payment`
  (`choosePlan` / `renew`).
- **Mail.** `OutgoingMail { to, subject, text, html?, kind? }`; `transactional` (default) is for
  "account notices", never suppressed and without an unsubscribe footer
  (`modules/mailing/src/contract.ts:40-62`). `sendMail` reads `getMailingOptions(config)`, which
  throws when mailing is not enabled (`modules/mailing/src/server/options.ts:15`).
  `deliverOnce` validates the scope (`^[a-z0-9][a-z0-9._:-]*$`, at most 128 characters) and kind,
  claims, sends with idempotency key `<scope>:<recipientKey>`, and returns `sent | rejected | done |
  in-flight | retry-later` (`deliveries.ts:46-82`). Its own doc comment names
  `billing.trial-ending:sub_42` as the lifecycle-scope example (`deliveries.ts:26-28`).
- **Waitlist's welcome mail** is the closest consumer: `deliverOnce(ctx, { scope:
  "waitlist.welcome:<id>", mail })` (`modules/waitlist/src/server/welcome-mail.ts:25-36`).
- **Auth's reset mail** renders text plus escaped HTML paragraphs from its dictionary
  (`modules/auth/src/mailing/reset-mail.ts:30-47`), copy in `config.locale`
  (`modules/auth/src/server/password-reset.ts:75`).
- **Scripts.** A module context is `{ db, clock, config }` (`foundation/core/src/module.ts:14-19`).
  The example app runs scripts with Node's type stripping: `node scripts/grant-role.ts`
  (`examples/next-app/package.json` scripts, `scripts/grant-role.ts`). `ops`' `runOpsScript` is for
  transactional one-off changes that roll back in a dry run (`modules/ops/src/scripts/ops-script.ts:1-13`):
  sending mail cannot roll back, so it does not fit.
- **Mailing CLI pacing**: `DEFAULT_PAUSE_MS = 500` between sends (Resend: two requests per second;
  `modules/mailing/src/cli/run.ts`).

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Billing mail entry | `modules/billing/src/mailing/` (new), `package.json` exports and peer deps | the run function and the mail rendering, optional like auth's |
| Billing copy | `modules/billing/src/messages/{en,pl}.ts` | subjects and bodies of four mails |
| Billing candidates | `modules/billing/src/server/` (a read of accounts in a window) | the range queries |
| Auth index | `modules/auth/migrations/0004_*.sql`, auth README §migrations | range on `created_at` without a table scan |
| Docs | `modules/billing/README.md` §1, §2, §9, §10, §12; auth README | the feature and the limitation removed |
| Example | `examples/next-app/scripts/`, `package.json`, `e2e/billing-reminders.spec.ts`, `e2e/migrations.spec.ts` | a script the app schedules and its e2e |

## Data

- `billing.entitlements(user_id pk, trial_ends_at, paid_until, is_lifetime, ...)`
  (`modules/billing/migrations/0001_create_entitlements.sql`); no index on `trial_ends_at` /
  `paid_until` (one row per paying or changed account; small).
- `auth.users(id, email unique, password_hash, created_at, password_changed_at)`; only the primary
  key and the email unique index.
- `mailing.deliveries` (scope, recipient_key) unique: the ledger the mail uses. No new billing table.

## Tests

- Billing: Vitest on PGlite with `createTestBilling` (`modules/billing/tests/support.ts`) and a test
  clock; `npm test -- modules/billing`. Mail tests use `fakeMailProvider()` from
  `@softure-ai/mailing/testing` (`modules/waitlist/tests/support.ts:68`).
- Example e2e: Playwright against the built app and Postgres; mails land in the fake provider's
  outbox file (`examples/next-app/e2e/outbox.ts`, `readMailOutbox`); migrations ledger list in
  `e2e/migrations.spec.ts`.
- Gap today: nothing covers reminder mail (it does not exist).

## Patterns to follow

- Optional integration entry with optional peer dependency: `modules/auth/src/mailing/index.ts`.
- Lifecycle mail through the ledger: `modules/waitlist/src/server/welcome-mail.ts:25-36`.
- Text + escaped HTML from the dictionary: `modules/auth/src/mailing/reset-mail.ts:30-47`.
- Dates: `formatLastDay` (`modules/billing/src/ui/format.ts:8`).
- Migrations start with a rollback comment (`docs/02-module-standard.md` §4).

## Prior work

- MO-1 `billing-entitlements` (`context/archive/2026-10-03-billing-entitlements/`): defined the
  reminder windows as badge and notice only and recorded the mail as a limitation.
- FU-2/FU-4 waitlist mail (`context/archive/2026-10-03-waitlist-double-opt-in/`,
  `2026-10-03-waitlist-welcome-html/`): ledger-scoped lifecycle mail.
- FU-9 (`context/archive/2026-10-03-billing-admin-requests/`): last change in `modules/billing/`;
  migrations up to 0004.

## SOFTURE modules

Covered: `@softure-ai/mailing` gives sending, the exactly-once ledger and the fake provider for
tests. No other module is needed; scheduling is the app's (cron, platform scheduler).

## Risks

- **Mail blast on first enable** (an app turns the run on and every long-ended account gets an
  "ended" mail). Likely without a bound; mitigate by sending an "ended" mail only within a few days
  after the end.
- **"Trial ended" right after registration with `trial.days: 0`** (the trial ends at the start of
  the registration day). Mitigate: no trial-ended mail when the trial ended at or before the
  account's creation.
- **Provider rate limit** (Resend 2/s): `retry-later` releases the claim, the next run resends;
  a pause between sends avoids it.
- **Double send** on overlapping runs: covered by the ledger's claim (`in-flight`).
- **Index creation on a large `auth.users`** takes a write lock during `CREATE INDEX`; apps here are
  small and the migrator runs at deploy. Low.
- **Collisions**: lane C items FU-20…FU-22 follow in `modules/billing/`; none is in flight.

## Relevant lessons

- L-001 (tsc builds): the new entry is plain TypeScript, built by the package's tsc.

## Answers to unknowns

- **What triggers the run?** Decided (roadmap owner assessment, confirmed by evidence): a server
  function the app calls on its own schedule (a cron job running a script). A request-time check
  would send only to accounts that visit, would put a mail send in the render path, and would
  miss the "ended" mail of accounts that never come back. `runOpsScript` does not fit (a mail
  cannot be rolled back).
- **How are accounts in a window found without scanning every account?** Answered: two bounded
  range queries. Rows: `trial_ends_at` or `paid_until` between the start of the catch-up window
  and the end of the widest reminder window (lifetime rows excluded). Accounts without a row: their
  trial end day is `created day + trial.days`, so the same window is a range on
  `auth.users.created_at` (`created >= startOfDay(today - catchUp - days)` and
  `created < startOfDay(today + reminder + 1 - days)`), with an index on `created_at` added in
  auth. Each candidate is then resolved with `resolveEntitlement` to decide its mail exactly.
- **Where does the code live?** Decided (auto): `@softure-ai/billing/mailing`, mailing as an
  optional peer dependency, following auth. Billing stays usable without mailing.
- **Mail kind?** Decided (auto): transactional, as mailing defines account notices; an
  unsubscribe must not hide that access ends.
- **Locale?** Answered: `config.locale` (accounts have no locale column; auth's reset mail does the
  same).

## Open questions

- None open. Decisions above are auto (safer option, owner assessment); no owner-only fact is needed.

## Decisions (auto)

- Depth normal: no money or irreversible data change; one additive index.
- Framing skipped (recorded in change.md).
