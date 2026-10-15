# Research: blog-indexnow-job

Input: change.md, issue #493. Sources: `modules/blog/src/{discovery,cli}`, `modules/jobs/src`, `modules/seo/src/server/indexnow.ts`.

## Current state (master 3b765d4)

- `submitBlogChanges(config, changes, { commit, fetchImpl })` computes the changed paths (`getIndexNowPaths`),
  imports `@softure-ai/seo` dynamically only when `seo()` is listed, resolves canonical URLs and calls
  `submitToIndexNow`. Outcomes: `not_configured`, `skipped`, `dry_run`, `submitted`, `failed { code, reason }`.
- The CLI (`src/cli/run.ts` `runPublish`) runs it after the cache refresh (`requestBlogRefresh`), so a crawler that
  answers the ping finds the new text; `--no-indexnow` skips it. `src/cli/report.ts` prints it for people and as
  the `blog|indexnow|…` line contract.
- `submitToIndexNow` (seo) folds every non-200/202 answer into `seo.indexnow_rejected` with the status only in the
  reason text; a network error or timeout is `seo.indexnow_unreachable`. It accepts a `fetchImpl`.
- `@softure-ai/jobs` (0.0.0, unreleased): `enqueueJob(ctx, { queue, payload, dedupKey })` refuses a queue the config
  does not define; handlers via `defineJobHandler({ payload: zod, run })` returning `ok()`, an `Err` (backoff retry),
  `failJob(code)` or `retryJobLater(code, seconds)`; `context.signal` aborts a handler that lost its job;
  `runDueJobs` and `listJobs` in `/testing` for tests.
- The architecture test keeps `@softure-ai/seo` reachable only by dynamic import; the release rules require every
  internal range to accept the workspace version (jobs is 0.0.0).

## Approach

- New entry `@softure-ai/blog/jobs`: the queue name `blog.indexnow`, a handler (`blogJobHandlers`, and
  `createBlogIndexNowJobHandler({ fetchImpl })` for tests), and `enqueueBlogIndexNow(ctx, changes)` for an app's own
  publishing path. Statically imports jobs; only apps that use jobs import it.
- Status classification without touching seo: the handler passes a `fetchImpl` wrapper that records the response's
  status and `Retry-After`, and joins the job's `signal`.
- The CLI picks the queue when the config lists `jobs()` with a `blog.indexnow` queue (no new blog option); it then
  imports the enqueue module dynamically. Detection reads the jobs module's options through `getModule`.
- Enqueue after the commit and after the cache refresh (outside the publish transaction): a job enqueued inside the
  transaction could run before the refresh. A failed enqueue is reported like a failed submit; the publish stands.
- Dedup key: a hash of the sorted changed paths, so a re-run with the same addresses while a job is pending
  returns that job.
- Rejected: an option on `blog()` to choose jobs (a second switch next to the queue the app must define anyway);
  enqueue inside `runBlogPublish` (ordering against the refresh, and it would tie the core publish to jobs);
  extending seo's result with the status (a seo change and release for a blog concern).

## Risks

- The queue is defined but the worker lacks the handler: jobs wait forever. README says to spread `blogJobHandlers`
  into the worker's handlers; `getQueueStats` shows the backlog.
- A union member `queued` on `BlogIndexNowOutcome` breaks an app's exhaustive switch at compile time (0.x minor).
