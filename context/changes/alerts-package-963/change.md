---
change_id: alerts-package-963
title: "alerts: a new package with one channel to tell the operator: mail and chat webhooks, deduplication, quiet repeats, jobs and health adapters (issue #963)"
status: plan_reviewed
roadmap_item: null
issue: 963
branch: claude/project-thread-nep58u
created: 2026-11-02
updated: 2026-11-02
archived_at: null
---

## Intent

Close [issue #963](https://github.com/SOFTURE/AI/issues/963): every app turns module events (a failed job, a schedule
that turned failing or late, a failing health check) into operator messages by hand, without deduplication, so one
outage sends hundreds of identical messages. A new package `@softure-ai/alerts` gives one call, `alert(ctx, input)`,
that deduplicates by key, summarizes repeats, sends a recovery on `resolveAlert`, and delivers through a jobs queue
to configured channels (mail through `@softure-ai/mailing`, Slack, Discord, Telegram, a generic JSON webhook), with
optional quiet hours per channel, a `softure-alerts test` command and an admin list of recent alerts.

## Context

Labels: `enhancement`. Filed and ordered by the owner. Softly related to #955 (jobs breaker and `onQueuePaused`) and
#954 (metering budget hits): this change does not wait for them; it defines the adapter surface they plug into.
No release in this change: the coordinator publishes the first version (NPM_TOKEN) in a batch.

## Constraints

- Starts from `templates/package/`; passes the workspace package rules (`tests/repo/packages.test.ts`).
- Owns `modules/alerts/` only, plus `package-lock.json` for the new workspace. Does not change jobs or mailing.
- No dependency cycle: alerts depends on jobs, never the other way; mailing is an optional peer used only by the
  `/mailing` entry.
- English only in the repository; copy through message dictionaries.

## Notes

- Framing: skipped. The issue names the problem and the API.
