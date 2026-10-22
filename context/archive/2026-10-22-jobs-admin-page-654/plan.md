---
change_id: jobs-admin-page-654
status: archived
---

# Plan: jobs admin page (issue #654)

Input: change.md, research.md. Complexity: medium (three server functions, a page, actions, a panel, docs).

## Phase 1: server functions (TDD)

Files: `modules/jobs/src/server/admin.ts`, `src/server/sync-items.ts`, `src/server/schedules.ts`,
`src/server/index.ts`, `src/contract.ts`, `src/messages/en.ts`, `tests/admin.test.ts`, `tests/sync.test.ts`.

1. Tests first: `listRecentJobs` (status filter, queue filter, order, limit bounds); `runScheduleNow` (enqueues the
   payload with the schedule dedup key, joins a pending run, refuses a queue that is not a schedule with
   `jobs.not_a_schedule`, leaves the slot alone); `retrySyncItem` (`failed` → `pending`, attempts 0, error cleared;
   `jobs.sync_item_not_found`, `jobs.sync_item_not_retryable`; the next `processSyncItem` runs it).
2. Implement them; new error codes in `contract.ts` with copy in `messages/en.ts`.

## Phase 2: page, actions and panel (TDD)

Files: `modules/jobs/package.json` (exports `./next`, `./ui`; peers `@softure-ai/ui`, `next`, `react` optional),
`module.json` + `src/index.ts` (routes `panel`, mount), `src/options.ts` (`panelRole`, `panelGuard`),
`src/server/options.ts` (routes getter), `src/next/*`, `src/ui/jobs-panel.tsx`, `tests/architecture.test.ts`,
`tests/next-action.test.ts`, `tests/jobs-panel.test.tsx`, `tests/panel-rows.test.ts`.

1. Tests first: actions refuse without a guard and without the role, run each steering call for an admin and
   revalidate the route; rows carry no payload and format dates in the app's zone; the panel renders queues,
   jobs and items with their actions and errors; markup guards.
2. `toJobsPanelData` (rows from stats, jobs and items), `JobsPanel` (client), `JobsPage`, the four actions.

## Phase 3: docs

`modules/jobs/README.md` (admin page section, `panelGuard`, composing the panel), `CHANGELOG.md` `## Unreleased`.

## Progress

- [x] Phase 1: server functions (cc75ff3)
- [x] Phase 2: page, actions and panel (217bb12; role check injected as `panelGuard`; tests use a stub guard, since a dev dependency on auth would form the same cycle)
- [x] Phase 3: docs (18b1128; README §1-§4, §8, §9; CHANGELOG `## Unreleased` with the migration steps)
