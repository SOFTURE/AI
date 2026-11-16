---
change_id: jobs-scheduled-tick
title: "jobs: one tick for the Node worker loop and a Workers Cron Trigger"
status: plan_reviewed
roadmap_item: RP-4
issue: null
branch: claude/project-thread-dufdk1
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Background jobs run on Cloudflare without a long-running process: the same `runJobsTick` that the Node worker loop calls runs from a Workers `scheduled()` handler every minute.

## Context

The Node worker (`modules/jobs/src/worker/run-job-worker.ts`) loops, claims due jobs (`server/claim.ts`, `server/run-due.ts`) and touches a health file (`worker/health.ts`, `node:fs`) and names itself with `node:os` `hostname`.

## Constraints

- Claims stay transactional so overlapping ticks never run a job twice.
- Node worker behaviour unchanged.
- A job that exceeds the Workers time budget is reported in the run log.

## Notes

- Item block: [`roadmap.md` → RP-4](../../foundation/roadmap.md).
