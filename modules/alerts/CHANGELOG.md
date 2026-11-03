# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/alerts`. When an app has run a version
in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- Docs: the README's `onQueuePaused` note names jobs 0.1.7, the version the package requires, instead of an older jobs.

## 0.1.0

- First version (#963): one channel to tell the operator. `alert(ctx, { key, severity, title, details?, link? })`
  deduplicates by key: the first occurrence goes out, repeats within `repeatWindowSeconds` (default 1 hour) are
  counted and summarized ("Happened 37 more times since the last message"), a rise in severity goes out at once, and
  `resolveAlert(ctx, key)` sends a recovery. Delivery runs on the jobs queue `alerts.deliver`, one job per channel, so
  a channel outage retries there and never blocks the caller; the `alerts.flush` schedule summarizes repeats nobody
  reported and prunes resolved alerts after `retentionDays`. Channels: `slackChannel`, `discordChannel`,
  `telegramChannel`, `webhookChannel` and, from `/mailing`, `mailChannel` over `@softure-ai/mailing` with a named
  sender; `defineAlertChannel` for the app's own. Per channel `minSeverity` and `quietHours`. Adapters:
  `alertsFromJobs()` for `onJobFailed`, `onScheduleStateChanged` and `onQueuePaused` (the last ready for jobs' queue
  pause), `alertFromHealthReport` for the checks of `@softure-ai/ops`. `softure-alerts test` sends a test message to
  each channel; `AlertsPage` lists recent alerts behind the app's role check.
