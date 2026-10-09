# Plan: billing-reminder-template-status-unlimited

Input: change.md (research and framing skipped, reasons there). Complexity: small (three phases).

## Today (master `8b0716f`)

- `sendAccessReminders(ctx, { catchUpDays, pauseMs, sleep })` finds the due accounts (`findAccessReminders`), renders
  the package mail (`renderAccessReminderMail`) and sends it through `deliverOnce` under
  `getAccessReminderScope(kind, userId, endsAt)`. The app cannot change the mail or the scope.
- `@softure-ai/billing/scripts` has five write scripts on `defineOpsScript`; the ops runner prints
  `before` / `after` and rolls back a dry run. There is no read-only script; the ops runner has no read-only mode.
- `AccessBadge` maps trial / paid / lifetime / read-only to a fixed tone, prints "N days left" or "until <long date>",
  and shows a 4000-day trial as "Trial · 4000 days left". `AccessNotice` renders only inside a reminder window and has
  two fixed looks (ending, ended).

## Goal

`@softure-ai/billing` 0.1.11 with all three points of #323.

**Out of scope:** a read-only mode in `@softure-ai/ops` (#328 owns that package now), switching billing's loop to
`runDeliveries`, a per-account locale for the mail.

## Key decisions

- **`buildMail(context)`** on `SendAccessRemindersOptions`: `context` = `{ reminder, lastDay, link, mail }` (the due
  account with `userId`, `email`, `kind`, `endsAt`; the formatted last day; the payment URL; the package's own
  rendering). Returns `AccessReminderMail`, `null` to send nothing to that account this run (counted in `skipped`),
  or a promise of either. A throw propagates like a database error (the ledger keeps the run resumable).
- **`getScope(reminder)`**: the delivery scope; `getAccessReminderScope` by default. An app moving from its own job
  passes its old scope, so accounts its job already mailed are `done`, not mailed twice.
- **`entitlement-status --email=…|--user=…`** (`createEntitlementStatusScript(config, { clock? })`): read-only; the
  report's `before` and `after` are the same status `{ userId, state, trialLastDay, paidLastDay, isLifetime,
  access }` (`state`: `trial`, `paid`, `lifetime`, `read_only`; last days `YYYY-MM-DD` in the app's time zone, `null`
  for no paid access). With or without `--commit` it writes nothing; the description says so. No account: refused.
- **`unlimitedAfterDays?: number`** on `AccessBadge`: trial or dated paid access with more days left than this reads
  `messages.badge.unlimited` ("Unlimited access"), success tone, `data-unlimited="true"`. Unset by default.
- **`compact?: boolean`**: the detail is shorter: a trial shows `formatDayCount` ("5 days"), dated paid access
  `until <formatShortLastDay>`.
- **`tones?: Partial<Record<AccessBadgeKind, AccessTone>>`**, kinds `trial`, `trial-ending`, `paid`, `paid-ending`,
  `lifetime`, `unlimited`, `read-only`; exported `getAccessBadgeKind(entitlement, { unlimitedAfterDays })`.
  `AccessNotice` takes `tones?: Partial<Record<"ending" | "ended", "neutral" | "danger">>` for its frame (amended in the implementation: ui compiles no other frame).
- New message `badge.unlimited` in en and pl.

## Phases

### Phase 1: reminder template and scopes (TDD)
Tests in `tests/reminder-mail.test.ts`: the app's mail is sent; `null` skips and counts; the context carries the
default mail and the account; a custom scope already in the ledger is not mailed again. Then implement.

### Phase 2: entitlement-status script (TDD)
Tests in `tests/status-script.test.ts` (a file of its own, amended in the implementation): status of a trial, a paid, a lifetime and a read-only account; `--commit`
writes nothing; unknown account refused; no email in the report. Then implement and export from `/scripts`.

### Phase 3: badge and notice (TDD)
Tests in `tests/access.test.tsx`: unlimited after N days for trial and paid; compact detail; tone overrides;
notice tones; defaults unchanged. Then implement, wire `/next`, messages, README, CHANGELOG, version 0.1.11
(package.json, module.json, lock).

## Progress

- [x] Phase 1: `buildMail`, `getScope`, three tests in `tests/reminder-mail.test.ts`.
- [x] Phase 2: `createEntitlementStatusScript` in `src/scripts/status-script.ts`, six tests.
- [x] Phase 3: badge kinds, `unlimitedAfterDays`, `compact`, `tones`; notice `tones`; `/next` wired; eleven tests.
- [x] Docs: README §1, §4, §8, §12; CHANGELOG 0.1.11; version in package.json, module.json, package-lock.
- [x] Gates: typecheck, lint, test, build.
