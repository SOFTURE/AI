# Plan: billing-reminder-mail

Input: change.md, research.md. Complexity: medium (two packages, one index, a new package entry, an
e2e through a script).

## Goal

An app with billing and mailing calls `sendAccessReminders(ctx)` from
`@softure-ai/billing/mailing` on its own schedule (a cron job running a script). Each run mails every
account whose trial or dated paid access is in its reminder window ("ends on {date}") or ended
within the last `catchUpDays` days ("has ended"), exactly the four states the in-app notice shows.
Each mail goes out at most once per account, kind and end instant (`mailing.deliveries`), also
when runs repeat or overlap; a provider outage leaves it for the next run. Candidates come from
two bounded range queries, never a scan of every account. Unit tests on PGlite and the example
app's e2e (a script run, mails read from the fake provider's outbox) prove it.

**Out of scope:** scheduling (the app's cron), a request-time trigger, per-account locales, HTML
templates the app supplies, lifetime accounts (they never end), a history of reminders beyond
mailing's ledger, and the other lane C items (FU-20, FU-21, FU-22).

## Approach

**Starting point:** `resolveEntitlement` already yields `trial|paid` with `isEnding` and
`read_only` with `since`/`reason` (`modules/billing/src/entitlement.ts:21-33`); accounts without a
row derive their trial from `auth.users.created_at` (`server/entitlements.ts:18-40`); mailing's
`deliverOnce` sends once per scope and recipient (`modules/mailing/src/server/deliveries.ts:60`).

**Chosen:** a pure decision per account (root), a read that lists the accounts with a reminder due
(`/server`, no mailing dependency), and the sender in a new `/mailing` entry with mailing as an
optional peer dependency, like `@softure-ai/auth/mailing`. Billing stays usable without mailing,
and an app with its own mail can use the read alone.
Rejected: `dependsOn: { mailing }` on billing - forces every billing app to enable mailing;
a request-time check in `CurrentAccessNotice` - only visitors get mail, a send in the render path,
and no "ended" mail for accounts that never return; an `ops` script - a sent mail cannot be rolled
back, so its dry-run transaction model does not fit.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Trigger | a run function the app schedules | owner assessment of FU-6 | research (roadmap) |
| Where | `@softure-ai/billing/mailing`, optional peer dep | auth's precedent; billing without mailing keeps working | research |
| Window identity | scope `billing.<kind>:<userId>:<endsAt ms>` | a new end (extension, renewal, refund) is a new window; the same end never mails twice | plan |
| Kinds | `trial-ending`, `paid-ending`, `trial-ended`, `paid-ended` | the notice's four states, from `resolveEntitlement` | research |
| Ended mails | only within `catchUpDays` (default 3) local days after the end day | no blast to long-ended accounts on first enable; a missed run still catches up | research (risk) |
| No-trial accounts | no `trial-ended` mail when the trial ended at or before the account's creation | `trial.days: 0` would mail every new account | research (risk) |
| Mail kind | transactional | an account notice; an unsubscribe must not hide that access ends | research |
| Locale | `config.locale` | accounts have no locale; auth's reset mail does the same | research |
| Pacing | `pauseMs` (default 500) after each provider call | Resend's two requests per second, as `softure-mail` | research |
| Index | `auth.users(created_at)` in auth `0004` | the row-less range must not scan the table | research |

**Critical details:**
- The row-less range is derived from the trial end formula `startOfDay(createdDay + trial.days)`:
  candidates have `created_at >= startOfDay(today - catchUpDays - trial.days)` and
  `created_at < startOfDay(today + trial.reminderDays + 1 - trial.days)`; stored rows use
  `trial_ends_at` / `paid_until` in `[startOfDay(today - catchUpDays), startOfDay(today + max(reminderDays) + 1))`.
  The ranges are a superset; `getAccessReminder` decides each candidate exactly, so an off-by-one in
  a bound can only add candidates that then get nothing, never drop one inside the window.
- `deliverOnce` throws on a database failure; the run lets it propagate (the cron logs it, the next
  run continues, the ledger prevents a double send).

## Phase 1: Which accounts are due a reminder

**Discipline:** TDD. **Files:** `modules/billing/src/reminder.ts` (new), `src/index.ts`,
`src/server/reminders.ts` (new), `src/server/index.ts`, `modules/auth/migrations/0004_index_users_created_at.sql` (new),
`modules/billing/tests/reminder.test.ts` (new), `modules/billing/tests/reminders.test.ts` (new), auth README.

1. `src/reminder.ts`: the pure decision. Contract:
   `ACCESS_REMINDER_KINDS = ["trial-ending", "paid-ending", "trial-ended", "paid-ended"]`,
   `getAccessReminder(input: { record, accountCreatedAt, now, policy, catchUpDays }): { kind, endsAt } | null`.
   Uses `resolveEntitlement`: `trial`/`paid` with `isEnding` and an `endsAt` give the ending kinds;
   `read_only` gives the ended kind of its `reason` with `endsAt = since` when `getDayNumber(now) -
   getDayNumber(since) <= catchUpDays`, except `trial_ended` with `since <= accountCreatedAt`.
   Lifetime and outside-window give null. Export `MAX_CATCH_UP_DAYS = 365`, the type
   `AccessReminderKind`, and `getAccessReminderScope(kind, userId, endsAt)` →
   `billing.<kind>:<userId>:<endsAt.getTime()>` from the root entry.
2. `modules/auth/migrations/0004_index_users_created_at.sql`: `CREATE INDEX users_created_at_idx ON
   auth.users (created_at)`, rollback comment `DROP INDEX auth.users_created_at_idx`. The auth README
   migrations line (`README.md:269`) and the header comment of `modules/auth/src/schema.ts` name it.
3. `src/server/reminders.ts`: `findAccessReminders(ctx, { catchUpDays? }): Promise<AccessReminderDue[]>`,
   `AccessReminderDue = { userId, email, kind, endsAt }`, sorted by `endsAt` then `userId`.
   Two queries (stored rows not lifetime with either end in range, joined to `auth.users`; accounts
   without a row in the `created_at` range, record from `getDefaultRecord`), then
   `getAccessReminder` per candidate. Validates `catchUpDays` (integer 0..365, default 3; a bad
   value throws: a caller bug). Read-only: no writes. Exported from `/server`.

**Tests:**
- `reminder.test.ts`: trial outside the window → null; trial on its first reminder day and its last
  day → `trial-ending` with its end; dated paid in its window → `paid-ending`; lifetime → null;
  trial ended today and `catchUpDays` days ago → `trial-ended`, one day more → null; paid ended
  after the trial → `paid-ended` with `paidUntil`; `trial.days: 0` account → null;
  `reminderDays: 0` → no ending kind; scope format and length under 128.
- `reminders.test.ts` (PGlite, test clock): row-less account in its trial window found with its
  derived end; row-less account outside found nothing; stored trial extension in window; paid in
  window; ended within catch-up; lifetime row skipped; a row-less account created long ago not
  returned; the query plan aside, the result equals `getAccessReminder` over all accounts for a
  spread of creation days (a brute-force cross-check over 40 accounts created on consecutive days).

**Done when:**
- Automated: `reminder.test.ts` and `reminders.test.ts` pass, including the brute-force cross-check.
- Automated: `auth.users_created_at_idx` exists after migrating a test database (assertion in `reminders.test.ts`).
- Automated: Gates green (typecheck, lint, test).

## Phase 2: The reminder mail through mailing

**Discipline:** TDD. **Files:** `modules/billing/src/mailing/{index,reminder-mail}.ts` (new),
`src/messages/{en,pl}.ts`, `package.json` (export `./mailing`, optional peer `@softure-ai/mailing`,
devDependency for tests through the workspace), `tsconfig*.json` if references need it,
`modules/billing/tests/reminder-mail.test.ts` (new), `README.md`.

1. `messages`: `reminderMail.{trialEnding,paidEnding,trialEnded,paidEnded}.{subject,body}` with
   `{date}` (last day with access, `formatLastDay`) and `reminderMail.link` ("{action}: {url}"
   style line built from `notice.choosePlan` / `notice.renew`), `en` and `pl`.
2. `src/mailing/reminder-mail.ts`: `renderAccessReminderMail(messages, { kind, lastDay, link })` →
   `{ subject, text, html }`: text paragraphs plus the bare link, HTML with escaped paragraphs and
   the link as an anchor (auth's reset mail shape). `sendAccessReminders(ctx, { catchUpDays?,
   pauseMs?, sleep? }): Promise<AccessReminderSummary>` with `{ due, sent, skipped, rejected,
   retryLater }`: `findAccessReminders`, then `deliverOnce(ctx, { scope:
   getAccessReminderScope(...), mail: { to, subject, text, html } })` per account, a pause after
   every outcome that called the provider (`sent`, `rejected`, `retry-later`). The link is
   `appOrigin + routes.payment`.
3. `src/mailing/index.ts` exports both, the summary type and the options type.
4. `README.md`: §1 (what it provides), §2 (optional peer), a "Reminder mail" part in §4 with the
   scheduling snippet and what each summary field counts (`skipped`: already sent or being sent by
   another run), §9 copy, §12 drops the FU-6 line; status line names FU-6.

**Tests (PGlite + `fakeMailProvider`):** one account in its trial window gets one `trial-ending`
mail with the date and `https://app.example.com/payment`; a second run sends nothing (`skipped`);
a trial extended to a new end in the window mails again; ended within catch-up mails
`trial-ended`; paid ending and paid ended use the renew copy; lifetime and outside-window accounts
get nothing; a provider outage counts `retryLater` and the next run sends; `pauseMs` calls `sleep`
once per provider call and never for skipped ones; two runs at once (`Promise.all`) send one mail
and each summary's `sent + skipped` equals its `due`; `pl` locale renders Polish copy; HTML escapes
the copy.

**Done when:**
- Automated: `reminder-mail.test.ts` passes.
- Automated: `@softure-ai/billing/mailing` resolves in the build (`npm run build`) and the package shape test passes.
- Automated: Gates green (typecheck, lint, test).

## Phase 3: Example app script and e2e

**Discipline:** test-after. **Files:** `examples/next-app/scripts/send-access-reminders.ts` (new),
`examples/next-app/package.json` (script `access-reminders`), `examples/next-app/e2e/billing-reminders.spec.ts` (new),
`examples/next-app/e2e/migrations.spec.ts` (auth 4), `examples/next-app/README.md` if it lists scripts.

1. Script: opens `config.database.url` with `createDatabase(url, { max: 1 })`, runs
   `sendAccessReminders({ db, clock: systemClock, config })`, prints the summary as one line, closes.
2. e2e: register an account, move its trial end into the reminder window in Postgres, run the
   script (`node scripts/send-access-reminders.ts` with `MAIL_OUTBOX`), find one `trial-ending`
   mail to it with the payment link; run again, still one; end the trial a minute ago, run, find
   one `trial-ended` mail. Cleanup deletes the account.
3. `migrations.spec.ts`: `auth 4 index_users_created_at (applied)`.

**Done when:**
- Automated: `npm run e2e` passes in the example app, including `billing-reminders.spec.ts` and the ledger list.
- Automated: Gates green (typecheck, lint, test, build).
- Manual: impl review recorded in `reviews/impl-review.md`.

## Risks and rollback

- Mail to the wrong accounts (a window bug): unit tests cross-check the query against the pure rule;
  an app only sends when it schedules the run. Rollback: stop the schedule; revert the entry.
- Blast on first enable: ended mails capped by `catchUpDays`.
- Index migration on a big `auth.users`: brief write lock; forward-only like every migration here,
  rollback by the documented `DROP INDEX`.
- Phase 2 rollback: remove the entry and the copy; phase 1 alone sends nothing.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Which accounts are due a reminder

#### Automated
- [x] 1.1 `reminder.test.ts` and `reminders.test.ts` pass, including the brute-force cross-check — a9cccf2
- [x] 1.2 `auth.users_created_at_idx` exists after migrating a test database — a9cccf2
- [x] 1.3 Gates green (typecheck, lint, test) — a9cccf2

### Phase 2: The reminder mail through mailing

#### Automated
- [x] 2.1 `reminder-mail.test.ts` passes — b1d1452
- [x] 2.2 `@softure-ai/billing/mailing` builds and the package shape test passes — b1d1452
- [x] 2.3 Gates green (typecheck, lint, test) — b1d1452

### Phase 3: Example app script and e2e

#### Automated
- [x] 3.1 `npm run e2e` passes, including `billing-reminders.spec.ts` and the ledger list
- [x] 3.2 Gates green (typecheck, lint, test, build)

#### Manual
- [ ] 3.3 Impl review recorded in `reviews/impl-review.md`
