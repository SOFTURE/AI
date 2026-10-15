# Plan: billing-jobs

Input: change.md, research.md (framing skipped, reason in change.md). Complexity: small (two phases).

## Goal

`@softure-ai/billing/jobs` exports `billingJobHandlers`, `createBillingJobHandlers(options)` and
`billingJobSchedules`, so an app with `@softure-ai/jobs` runs the access reminder mail and the invoice request expiry
as daily schedules; the README's jobs recipe replaces the cron recipe and the CHANGELOG says how to move.

**Out of scope:** changing `sendAccessReminders` or `expireStaleRequests`; any adopting app; a release.

## Approach

Chosen: a `./jobs` entry in the #491 pattern. The reminder handler imports `../mailing/index.js` lazily inside its
`run`, so the entry loads without `@softure-ai/mailing`. Rejected: a static import (breaks apps without mailing);
putting the reminder handler in `./mailing` (would make mailing users load jobs); a self-enqueueing handler (jobs
schedules exist now).

## Decisions (auto)

- Queues `billing.access-reminders` and `billing.expire-requests`, both `every: "1d"` (00:00 UTC). The old recipe ran
  them daily too; an app picks another `every` by writing its own entry.
- Outcome mapping: `halted.reason === "mailing.unavailable"` or `retryLater > 0` → `err("mailing.unavailable")`
  (queue backoff); `provider_refused` / `quota_exceeded` → `failJob(reason)`; otherwise `ok(summary)`.
- `createBillingJobHandlers({ reminders })` takes `SendAccessRemindersOptions` without `dryRun` (a dry run job would
  never send). `billingJobHandlers = createBillingJobHandlers()`.
- An app without `mailing()` that schedules the reminders gets a thrown config error per run (logged, retried, then
  failed); the README says to spread only the expiry schedule in that case. No new error code.

## Phase 1: The jobs entry

**Discipline:** TDD. **Files:** `modules/billing/{src/jobs/index.ts,src/index.ts,module.json,package.json,
tests/jobs.test.ts}`.

- Handlers and schedules as above; manifest `dependsOn.jobs: "^0.1.1?"`; `./jobs` export; optional peer jobs `^0.1.1`.

Done when: tests show the schedules parse and name a handler each; expiry runs through `runDueJobs`; reminders send
through `runDueJobs`; an outage is retried and later succeeds without a second mail; a refused account fails the job;
handler options (`buildMail`) reach the run.

## Phase 2: Docs and gates

**Discipline:** test-after. **Files:** `modules/billing/{README.md,CHANGELOG.md}`.

- README: the jobs recipe replaces both cron scripts; the plain functions stay documented for apps without jobs.
- CHANGELOG `## Unreleased`: the entry, the new optional peer, a step-by-step migration from the two scripts.

Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Risks and rollback

- Additive: a new subpath and an optional peer; apps that ignore it see no change. Rollback: revert the merge.
- Conflicts with PR #485 in billing's README, CHANGELOG and manifest: merge master in after it lands.

## Progress

- [x] Phase 1: 5009c4a
- [ ] Phase 2
