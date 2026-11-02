# Research: alerts-package-963

Input: change.md, issue #963, master c9380e5.

## What exists

- `@softure-ai/jobs` 0.1.6: `onJobFailed({ queue, jobId, code, attempts, at }, ctx)` and
  `onScheduleStateChanged({ queue, state, lastFailureCode, at }, ctx)` hooks (`modules/jobs/src/options.ts`), run after
  the write commits; a throw is logged and harmless. `enqueueJob(ctx, { queue, payload, runAt, dedupKey })` writes in
  the caller's transaction. Handlers return `ok()`, an `Err` (retried with backoff), `failJob(code)` or
  `retryJobLater(code, seconds)`. `onQueuePaused` does not exist yet; #955 proposes `onQueuePaused({ queue, code, until })`.
- Modules ship their job handlers from a `./jobs` entry (`modules/auth/src/jobs/index.ts`): a `...Handlers` object and
  `...Schedules` for `jobs({ schedules })`.
- `@softure-ai/mailing` 0.2.5: `sendMail({ config }, { to, subject, text, sender })` from `/server`; named senders
  (`mailing({ senders })`, #798) give the operator sender. Transactional mail needs no `db`.
- `@softure-ai/core` 0.2.7: `requestJson` fails on a non-JSON 2xx body (Slack answers `ok` as text), `requestBytes`
  accepts a POST with a JSON body and any answer, with the same status mapping (`core.http_refused`,
  `core.http_rate_limited` with `retryAfterSeconds`, `core.http_unavailable`, ...). It never logs the URL, which matters
  for Telegram (the bot token is in the path). `getWallClock` / `getZonedInstant` give local time per IANA zone.
- `@softure-ai/ops` health: `HealthReport { status, checks: Record<name, "ok" | "failed" | "timed_out"> }`. No hook;
  an app that wants alerts runs the checks itself (a scheduled job) and passes the report on.
- CLI pattern: `softure-mail` = `bin.ts` → `command.ts` (`loadAppConfig` from `@softure-ai/core/cli`) → `run.ts`
  (`runMailCli({ config, argv })`, testable).
- Admin page pattern: jobs `/next` `JobsPage` behind `panelGuard: { requireRole, authorizeRole }`, `notFound()`
  without a guard; panel component in `/ui` with only classes `@softure-ai/ui` compiles (architecture test).
- Tests: PGlite through `createTestDatabase(config.modules)` from `@softure-ai/db/testing`; jobs testing runner
  `runDueJobs` from `@softure-ai/jobs/testing`.

## Chat webhook formats

- Slack incoming webhook: `POST {"text": "..."}`, answers `200 ok` (text).
- Discord webhook: `POST {"content": "..."}` (at most 2000 characters), answers `204`.
- Telegram Bot API: `POST https://api.telegram.org/bot<token>/sendMessage {"chat_id", "text"}` (at most 4096
  characters), answers JSON; plain text avoids Markdown escaping.
- Generic: a JSON POST of the alert message.

## Options considered

- Deduplication state: one row per key in `alerts.alerts` (status firing or resolved, occurrence count, repeats not
  yet reported, last notified time). The read-modify-write runs in one transaction under `SELECT ... FOR UPDATE`,
  after an `INSERT ... ON CONFLICT DO NOTHING` creates the row, so racing callers count each occurrence once.
- Repeats left unreported when no further alert arrives: a scheduled `alerts.flush` job sends their summary once the
  window has passed, and prunes old resolved rows.
- Mail without a hard dependency on mailing: a `/mailing` entry with `mailChannel()` and mailing as an optional peer.
