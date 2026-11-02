---
change_id: jobs-owned-status-958
status: in_progress
---

# Plan: owned jobs and their status (issue #958)

Input: change.md, research.md. Complexity: medium (one migration, server API, a route, a client hook, docs).

## Phase 1: owner, result reference, owner reads, retention

Files: `migrations/0008_add_owner_and_result_ref.sql` (new), `src/schema.ts`, `src/contract.ts`, `src/options.ts`,
`src/server/{enqueue,job-row,claim,process,admin,maintenance,index}.ts`, `src/server/own-jobs.ts` (new),
`tests/own-jobs.test.ts` (new).

1. Migration 0008 (0009 if #955 merges first): `owner_id text` (1 to 200 characters), `result_ref text` (1 to 200, only on a succeeded job), an
   index `(owner_id, created_at)` where `owner_id IS NOT NULL`.
2. `enqueueJob({ ..., ownerId })`: checked 1 to 200 characters; stored. `Job` gains `ownerId` and `resultRef`.
3. A handler returns `ok({ resultRef })` (with or without `summary`): an identifier (letters, digits, `_ . : / -`, at
   most 200), stored on success; an invalid one dropped with a warning, the job stays succeeded. `retryJob` clears it.
4. `getOwnJob(ctx, { id, ownerId })` → `Ok<OwnJob>` | `Err<"jobs.not_found">`: id, queue, status, progress,
   `resultRef`, `failureCode` (`last_error` when failed, `jobs.cancelled` when cancelled, otherwise null),
   `cancelRequestedAt`, created/updated/finished. Never the payload. `toOwnJobStatus(job)`: its JSON form.
5. `requestOwnJobCancel(ctx, { id, ownerId })`: `requestJobCancel` scoped to the owner (owner in every statement).
6. `retention.ownedDays` (default 1): `pruneJobs` keeps an owned finished job until its status retention and
   `ownedDays` have both passed.
7. Tests first: owner stored, read by owner, `not_found` for another owner / a job without owner / a bad id, failure
   code without text, result reference stored and invalid dropped, owner cancel, pruning floor.

## Phase 2: route factory

Files: `src/next/job-status-route.ts` (new), `src/next/index.ts`, `tests/job-status-route.test.ts` (new).

1. `createJobStatusRoute({ getOwnerId, allowCancel?, getContext? })` → `{ GET, DELETE }` for
   `app/api/jobs/[id]/route.ts`. `getOwnerId(request)` → owner id or null (401). GET: 200 status JSON or 404.
   DELETE: 405 unless `allowCancel`; 200, 404 or 409 `jobs.not_cancellable`. Every answer `Cache-Control: no-store`;
   a failure opening the database is 503, an unexpected one 500, logged by kind only.

## Phase 3: client hook

Files: `src/react/{index,use-job-status}.ts` (new), `package.json` (`./react` entry), `tests/use-job-status.test.tsx`
(new).

1. `useJobStatus(id, { url?, intervalMs?, maxIntervalMs?, stopOn? })` → `{ job, error, isPolling, cancel }`. Polls
   the route; the interval grows by half while nothing changes (to `maxIntervalMs`), resets on a change, doubles after
   a network failure; stops on `succeeded`, `failed`, `cancelled` (or `stopOn`) and on 401/404; pauses while the
   document is hidden; polls at once on `visibilitychange` back to visible and on `online`. `cancel()` sends DELETE.

## Phase 4: docs

Files: `README.md`, `CHANGELOG.md` (`## Unreleased`).

## Decisions (auto)

- `result_ref` is a column on the job, written from `ok({ resultRef })`: the issue asks `getOwnJob` for it and there
  was nowhere to keep it. An identifier pattern keeps free text out.
- The owner retention is a floor (`ownedDays`, default 1), not a replacement: failed jobs keep their longer operator
  retention.
- The hook lives in a new `./react` entry, not `./ui`, so an app can use it without `@softure-ai/ui`; it listens to
  `online` itself instead of depending on pwa.
- `DELETE` is off unless `allowCancel: true`: cancelling is a product decision of the app.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
- [ ] Phase 4
