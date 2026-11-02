---
change_id: alerts-package-963
verdict: approved
---

# Implementation review

Reviewed the diff of phases 1 to 5 against plan.md and issue #963.

## Acceptance

- `alert` with mail (`/mailing`, named sender), Slack, Discord, Telegram and generic JSON channels: done, each with a
  request test and the status mapping.
- Deduplication by key with summarized repeats and `resolveAlert`: done; the flush schedule covers repeats with no
  later occurrence.
- Sending through a jobs queue: one `alerts.deliver` job per channel, written in the caller's transaction; a channel
  outage retries and leaves the other channels alone (tested through `runDueJobs`).
- Adapters: `alertsFromJobs` (`onJobFailed`, `onScheduleStateChanged`, `onQueuePaused`) and `alertFromHealthReport`.
- Quiet hours per channel, `softure-alerts test`, the admin list behind the guard: done.

## Findings

- MAJOR, fixed in review: a severity that flapped between `warning` and `critical` while firing sent a message on
  every rise, since a counted lower occurrence overwrote the stored severity. A firing key now keeps its highest
  severity; a test covers it.
- MINOR, accepted: the concurrency test runs on PGlite, which serializes connections; the race safety rests on
  `INSERT ... ON CONFLICT DO NOTHING` then `SELECT ... FOR UPDATE` in one transaction, a standard Postgres pattern.
- MINOR, accepted: deliveries carry no jobs dedup key; a retried mail is deduplicated by the provider's idempotency
  key, chat webhooks have none (documented by the at-least-once rule of jobs).

## Gates

typecheck, lint, the package's 72 tests, the repository tests (packages, build order, release rules, links, language)
and `npm run build` are green.

Verdict: approved.
