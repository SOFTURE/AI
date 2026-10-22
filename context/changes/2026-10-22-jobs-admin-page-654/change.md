---
change_id: jobs-admin-page-654
title: "jobs: admin page for queues, schedules, failed jobs and the sync ledger (issue #654)"
status: in_progress
roadmap_item: null
issue: 654
branch: claude/project-thread-crn6oz
created: 2026-10-22
updated: 2026-10-22
---

## Intent

Close [issue #654](https://github.com/SOFTURE/AI/issues/654) (labels `enhancement`, `pkg: jobs`): `@softure-ai/jobs`
has the steering functions but no UI, so every app with background work builds the same screen. Ship `JobsPage`
(`/admin/jobs`, role `panelRole`, default `admin`) and a composable `JobsPanel`: queues with counts, oldest due job
and schedule health with **Run now**; recent failed, cancelled and retrying jobs with **Retry** / **Cancel**; the
sync ledger per source with a status filter and **Retry item** (new `retrySyncItem`).

## Context

jobs 0.1.4 is the latest release; #651 and #653 are on master under `## Unreleased`. Releases are batched by the
coordinator: no version bump. The module standard (docs/02 §5, §8) puts the page and actions in `/next`, the
component in `/ui`, copy in `messages`, styling in `sft:` classes.

## Constraints

- No payload values and no error texts on the page: codes only.
- Every action checks the role from the session before it reads the form; a bound argument is never trusted.
- No package or module dependency cycle (auth, billing, mcp-access, waitlist, security, blog, analytics and mailing
  already depend on jobs).
- Apps that do not mount the page see no behaviour change.

## Acceptance

1. `JobsPage` renders for a holder of `panelRole` and is "not found" for anyone else.
2. Per queue: counts per status, oldest due job, schedule `lastSucceededAt`, failing with `lastFailureCode`, late;
   **Run now** enqueues the schedule's payload with its dedup key and joins a pending run.
3. Recent failed and cancelled jobs (and pending ones retrying after a failure) with code and attempts; **Retry** and
   **Cancel** call `retryJob` / `cancelJob`.
4. Sync ledger grouped per source with status, error code, attempts, last seen, a status filter, and **Retry item**
   (`retrySyncItem`: `failed` → `pending`, attempts reset).
5. The markup passes the module markup guards (no raw colour, no inline copy, only ui-compiled `sft:` classes).

## Notes

- Framing: skipped. The issue names the page, its parts and the actions; the module has the server functions.

## Decisions (auto)

- **The role check is injected, not imported.** jobs cannot depend on `@softure-ai/auth`: auth (and seven other
  packages) already depend on jobs, so both the package graph (`npm run build` order) and the module graph
  (`dependsOn`, `core.dependency_cycle`) would form a cycle. The app passes auth's two functions once:
  `jobs({ panelGuard: { requireRole, authorizeRole } })` from `@softure-ai/auth/next`. Without `panelGuard` the page
  is "not found" for everyone and the actions return `auth.forbidden` (closed by default).
- The page route is the manifest route `panel: /admin/jobs`, overridable through `jobs({ routes: { panel } })`
  like other modules; the actions revalidate it.
- "Run now" is a new server function `runScheduleNow(ctx, queue)`: `enqueueJob` with the schedule's payload and
  `SCHEDULE_DEDUP_KEY`; it does not move the schedule's slot, so the regular run still happens.
- Recent jobs come from a new `listRecentJobs(ctx, { statuses, queue, limit })`, most recently updated first; the
  panel rows never carry the payload.
- The sync ledger shows the latest 100 items (`listSyncItems`), grouped by source in the panel; the status filter is
  a `?sync=<status>` link on the page.
