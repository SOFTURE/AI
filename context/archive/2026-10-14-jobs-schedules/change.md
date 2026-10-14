---
change_id: jobs-schedules
title: "Jobs runs recurring schedules, and the packages' prune functions run through them (issue #491)"
status: archived
roadmap_item: null
issue: 491
branch: claude/project-thread-x0n7qj
created: 2026-10-14
updated: 2026-10-14
archived_at: 2026-10-14
---

## Intent

An app with `@softure-ai/jobs` declares a recurring schedule in `softure.config.ts` and its worker enqueues each due
run exactly once, however many workers run. auth, mcp-access, waitlist, security and analytics ship ready job
handlers and schedules for their prune functions, so an app registers them with one line instead of writing a cron of
its own, and `getQueueStats` tells it when a schedule has not run in time.

## Context

- Issue #491 (labels `enhancement`, `pkg: jobs`), a follow-up of #471 (`@softure-ai/jobs`, PR #482, unreleased 0.0.0).
- The owner ordered the refactor so packages carry no cron workarounds. Issue #490 (billing reminders and expiry as
  jobs) waits for this change and will use its schedules.
- Prune functions today: auth `pruneSessions`, `prunePasswordResets`; mcp-access `pruneMcpAccess`; waitlist
  `pruneUnconfirmedSignups`; security `pruneRateLimits`; analytics `pruneFunnelCounts`.

## Constraints

- Owns `modules/jobs/` and the new `jobs` entries (subpath, peer dependency, README, CHANGELOG) of auth, mcp-access,
  waitlist, security and analytics. Does not touch billing (#490) or any adopting app.
- The plain prune functions stay: apps without jobs keep their cron.
- No release in this change (the coordinator releases; jobs must be released first or together, since the other
  packages take it as an optional peer `^0.1.0`).
- Everything in English.

## Notes

- Framing: skipped. The issue names the problem and the asks; the owner ordered the work.
