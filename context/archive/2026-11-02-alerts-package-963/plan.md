# Plan: alerts-package-963

Input: change.md, research.md

## Goal

`@softure-ai/alerts` 0.1.0 (unreleased) in `modules/alerts/`: `alert` and `resolveAlert` with deduplication by key,
delivery through a jobs queue to named channels, adapters for jobs hooks and health reports, quiet hours, a test
command and an admin list.

## Approach

- Module `alerts({ channels, repeatWindowSeconds, retentionDays, panelGuard, panelRole })`, Postgres schema `alerts`,
  one table `alerts.alerts` keyed by the alert key. Depends on core, db and jobs; jobs never imports alerts.
- A channel is an object `{ kind, deliver(message, ctx), minSeverity, quietHours }` made by a factory:
  `slackChannel`, `discordChannel`, `telegramChannel`, `webhookChannel` (root entry, over `requestBytes`), `mailChannel`
  (`/mailing` entry, over `sendMail` with a named sender). An app can write its own channel with `defineAlertChannel`.
- `alert(ctx, input)`: in one transaction, create or lock the row; a new or resolved key fires (one delivery job per
  channel); a firing key within the window only counts; a firing key past the window sends a repeat summary. Repeats
  left over are summarized by the scheduled `alerts.flush` job. `resolveAlert(ctx, key)` resolves a firing key and
  sends a recovery with the leftover count.
- Delivery jobs on queue `alerts.deliver`, payload = the rendered-from data (key, kind, severity, title, details, link,
  counts, time), one job per channel; quiet hours move `runAt` to the end of the window unless the severity is
  exempt (default `critical`). The handler maps channel failures: refused or unconfigured fails at once, rate limited
  waits `Retry-After`, the rest retries with backoff.
- `alertsFromJobs()` returns `onJobFailed`, `onScheduleStateChanged` and `onQueuePaused` hooks (the last typed for
  #955's event, usable once jobs emits it); failures of the alerts queues are never alerted (no loop).
- `alertFromHealthReport(ctx, report)`: a failing check alerts `health:<name>`, a passing one resolves it; the report
  type is structural, so alerts does not depend on ops.
- `softure-alerts test [--channel <name>]`: sends a test message to each channel directly (no queue, no database).
- Admin: `listRecentAlerts(ctx)`, `AlertsList` in `/ui`, `AlertsPage` in `/next` behind `panelGuard`.
- Rejected: a hard dependency on mailing (forces mail on chat-only apps); `requestJson` for webhooks (Slack's `ok`
  body is not JSON); per-occurrence rows (the issue asks for counts, not history).

## Phase 1: Package, contract, options, schema, channels
**Discipline:** TDD. **Files:** `modules/alerts/{package.json,module.json,tsconfig*.json,CHANGELOG.md}`,
`src/{index,contract,options,schema,channels}.ts`, `src/messages/`, `migrations/0001_alerts.sql`, `tests/`.
Done when the module parses its options, migrates in PGlite, and each webhook channel sends the right request and maps
statuses to codes.

## Phase 2: Server: alert, resolve, flush, list, health adapter
**Discipline:** TDD. **Files:** `src/server/*`, `tests/alert.test.ts`, `tests/health.test.ts`.
Done when fire, count, repeat, flush, resolve and reopen enqueue the expected deliveries, quiet hours delay them, and
racing calls count once.

## Phase 3: Jobs entry
**Discipline:** TDD. **Files:** `src/jobs/*`, `tests/jobs.test.ts`.
Done when the delivery handler runs through `runDueJobs` against fake channels, maps failures, and `alertsFromJobs`
alerts and resolves from jobs events without alerting its own queues.

## Phase 4: Mail channel, CLI, admin list
**Discipline:** test-after. **Files:** `src/mailing/*`, `src/cli/*`, `src/ui/*`, `src/next/*`, tests.
Done when the mail channel sends through mailing's fake provider, `softure-alerts test` reports per channel, and the
page renders recent alerts behind the guard.

## Phase 5: Docs
**Discipline:** test-after. **Files:** `modules/alerts/README.md`, `CHANGELOG.md`.
Done when the README has the twelve sections and the gates pass.

## Risks and rollback

- A new package only: rollback is removing `modules/alerts/` and its lock entries. Nothing else changes.
- Telegram's token in the URL: never logged (requestBytes drops the URL; the handler logs codes only).

## Decisions (auto)

- Severities `info`, `warning`, `critical`; quiet hours exempt `critical` by default.
- Default repeat window 1 hour; flush schedule every 5 minutes; resolved rows kept 30 days.
- A missing webhook URL or token (an unset env) does not break config loading; the delivery fails with
  `alerts.channel_unconfigured` and is not retried.
- Jobs' `onQueuePaused` is typed locally (`{ queue, code, until }` per #955), not imported, so alerts works with jobs
  0.1.6.
- Metering (#954) plugs in by calling `alert` from its own hook; nothing specific is built for it now.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Package, contract, options, schema, channels

#### Automated
- [x] 1.1 Options, migration and channel request tests pass — 58ae41c
- [x] 1.2 Gates green (typecheck, lint, test) — 58ae41c

### Phase 2: Server: alert, resolve, flush, list, health adapter

#### Automated
- [x] 2.1 Deduplication, repeat, flush, resolve, quiet hours and race tests pass — 50a1be0
- [x] 2.2 Gates green (typecheck, lint, test) — 50a1be0

### Phase 3: Jobs entry

#### Automated
- [x] 3.1 Delivery handler and jobs adapter tests pass — 3f969b8
- [x] 3.2 Gates green (typecheck, lint, test) — 3f969b8

### Phase 4: Mail channel, CLI, admin list

#### Automated
- [x] 4.1 Mail channel, CLI and page tests pass — 41e10cb
- [x] 4.2 Gates green (typecheck, lint, test) — 41e10cb

### Phase 5: Docs

#### Automated
- [x] 5.1 README with twelve sections; links test green — fa63424
- [x] 5.2 Gates green (typecheck, lint, test, build) — fa63424
