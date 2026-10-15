# Research: billing-jobs

## What exists

- `sendAccessReminders(ctx, options)` (`modules/billing/src/mailing/reminder-mail.ts`) is one `runDeliveries` run of
  `@softure-ai/mailing`. Its summary carries `halted: { reason, httpStatus? } | null` with `reason` one of
  `mailing.unavailable` (the provider could not take a mail now; the run stops there unless `stopOnRetryLater: false`),
  `mailing.provider_refused` or `mailing.quota_exceeded` (the sending account is the problem), plus `retryLater`
  (mails left for the next run). Every mail is recorded once per scope in `mailing.deliveries`, so a repeated or
  overlapping run sends nothing twice. A database failure, a missing `mailing()` module and a bad `limit` throw.
- `expireStaleRequests(ctx)` (`modules/billing/src/server/requests.ts`) closes open invoice requests older than
  `requests.expireAfterDays`; idempotent, returns `{ expired }`.
- Both need only `{ db, clock, config }`; a jobs handler gets `JobHandlerContext` (`db`, `clock`, `config`, `job`,
  `signal`), which fits `ModuleContext<Queryable>`.
- `@softure-ai/jobs` 0.1.1 (#491): `jobs({ schedules: { "<queue>": { every: "1d" } } })` enqueues one run per period
  (UTC-aligned) with the dedup key `schedule`, so a run still retrying absorbs the next period. Handler results: `ok()`,
  an `Err` (retried with the queue's backoff until `maxAttempts`), `failJob(code)` (failed at once),
  `retryJobLater(code, seconds)`, a throw (retried as `jobs.handler_threw`).
- Pattern (#491): `src/jobs/index.ts` exporting `<pkg>JobHandlers` and `<pkg>JobSchedules` (`satisfies JobHandlers` /
  `JobSchedulesInput`), a `./jobs` export, `@softure-ai/jobs` `^0.1.1` as optional peer with `peerDependenciesMeta`,
  `jobs: "^0.1.1?"` in `module.json` and the inline manifest, a `tests/jobs.test.ts` that runs the schedules through
  `runDueJobs` from `@softure-ai/jobs/testing`.
- Billing keeps `@softure-ai/mailing` an optional peer. A static import of the reminder mail from the jobs entry would
  make `@softure-ai/billing/jobs` fail to load in an app without mailing. Precedent for a lazy import of an optional
  dependency: `modules/blog/src/next/refresh.ts`.
- Tests: `tests/reminder-mail.test.ts` sets up mailing with `fakeMailProvider({ respond })`, which simulates
  `unavailable` and `refused`.

## Findings that shape the plan

- Mapping per the issue: halted on `mailing.unavailable` (or `retryLater > 0` when the app turned `stopOnRetryLater`
  off) → an `Err` so jobs retries with backoff; halted on `provider_refused` / `quota_exceeded` → `failJob(reason)`:
  retrying within minutes does not fix a bad key or a spent daily quota, and the next period resumes from the ledger.
- The reminder handler needs the app's options (`buildMail`, `getScope`, `limit`, `catchUpDays`), which are functions
  and cannot travel in a schedule payload, so the handlers come from a factory, with a default instance.
- Schedules align to UTC; "daily at 09:00" is not expressible. `1d` runs at 00:00 UTC; an app that wants it more often
  sets its own `every` (the ledger keeps repeats harmless).

## Open questions

None; decisions are recorded in the plan.
