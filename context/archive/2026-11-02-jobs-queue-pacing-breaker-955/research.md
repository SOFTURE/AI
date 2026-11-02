# Research: queue pacing and a circuit breaker (issue #955)

## Findings

- `src/server/claim.ts` `claimJobs`: fails exhausted leases, then one `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP
  LOCKED LIMIT n)` per queue. It is the one place every worker and `runDueJobs` pass through, so a check there is
  shared by every process. Nothing per queue lives in the database today (queue options are config only).
- `completeJob` writes the job, its run row and the schedule in one transaction, then runs `onJobFailed` after the
  commit. The breaker's counter belongs in the same transaction, and `onQueuePaused` after the commit, the same way.
- `src/server/process.ts` `decide` turns a handler result into a `Completion`; `retryJobLater` is a `JobFailure` with
  `retryAfterSeconds`. `failJob` sets `retry: false`; `jobs.invalid_payload` never ran the handler.
- `releaseJob` already gives an attempt back (`attempts - 1`), the model for a refusal that should not cost one.
- The worker loop claims per queue each round and sleeps `pollIntervalMs`; a queue that claims nothing simply waits,
  so an unclaimed (paused or paced) job keeps its attempts without any extra code.
- Admin page: `JobsPage` reads `getQueueStats`, `toJobsPanelData` builds the rows, `JobsPanel` renders actions through
  `JobsPanelActions`; server actions go through `steer()` with the role check.
- Migrations are numbered per module (`0001`–`0006`), run with `search_path` on the module schema.

## Options

1. Pacing in the worker only (sleep between claims): not shared by two processes. Rejected.
2. Advisory locks per queue: no persistent state for the panel and the breaker. Rejected.
3. A `jobs.queue_state` row per queue, locked `FOR UPDATE` in the claim's transaction when the queue paces, holding
   `next_allowed_at` / the window, the breaker's counter and the pause. Chosen: one row serializes the budget across
   workers, survives restarts, and the panel reads it.

## Recommendation

Option 3.
