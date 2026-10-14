# Plan: blog-indexnow-job

Input: change.md, research.md (framing skipped, reason in change.md). Complexity: medium (three phases).

## Goal

With `jobs({ queues: { "blog.indexnow": {} } })` in the config, `softure-blog publish --commit` enqueues one
`blog.indexnow` job and reports `queued`; the worker submits it with retries (network errors, 5xx, 429 with its
`Retry-After`) and fails it at once on another 4xx. Without that queue nothing changes. All gates green.

**Out of scope:** changes to jobs or seo; a release.

## Approach

As research.md: an `@softure-ai/blog/jobs` entry with the handler and `enqueueBlogIndexNow`; queue detection in a
module that does not import jobs; a dynamic import from the CLI.

## Phase 1: Shared IndexNow target, queue detection, handler and enqueue

**Discipline:** TDD. **Files:** `src/discovery/submit.ts`, `src/jobs/{index,queue,handler,enqueue}.ts`,
`package.json` (export `./jobs`, optional peer and dev dependency on jobs), `tests/jobs.test.ts`.

- Extract `resolveIndexNowTarget(config)` from `submitBlogChanges` (seo dynamic import, settings, canonical URLs).
- `BLOG_INDEXNOW_QUEUE`, `hasBlogIndexNowQueue(config)` (no jobs import).
- `enqueueBlogIndexNow(ctx, changes)` → `BlogIndexNowSubmit` with `queued { jobId, count, isDuplicate }`, `skipped`
  or `not_configured`; payload `{ paths }`, dedup key `indexnow:<sha256 of the sorted paths, 32 hex>`.
- Handler: payload schema; `submitted`/`skipped` → `ok()`; unreachable or 5xx → `Err` (backoff); 429 →
  `retryJobLater(Retry-After)` or `Err` without the header; other 4xx, bad key, foreign URL, seo gone → `failJob`.

## Phase 2: CLI and report

**Discipline:** TDD. **Files:** `src/cli/run.ts`, `src/cli/report.ts`, `tests/cli.test.ts`, architecture test.

- Committed run with the queue: dynamic import of `../jobs/enqueue.js`; an enqueue error becomes
  `failed { code: "blog.indexnow_enqueue_failed" }`. Dry run and no queue: unchanged.
- Report: `indexnow: queued N URL(s) as job <id> on blog.indexnow` (duplicate: "already queued as job <id>");
  lines `blog|indexnow|queued|<count>|<job id>|<new|duplicate>|<paths>`.
- Architecture: the CLI and root entry never import jobs statically.

## Phase 3: Docs and gates

**Files:** `modules/blog/README.md`, `CHANGELOG.md`, `package.json` description.

- README: the jobs path (queue config, worker handlers, own publishing path), retry rules, CLI output.
- CHANGELOG Unreleased: what an app changes to opt in.

## Risks and rollback

Revert the merge; the synchronous path is the default and stays intact.

## Decisions (auto)

- Detection by the configured queue, no blog option (simplest; the queue must be defined anyway).
- Enqueue after the refresh, outside the publish transaction (ordering with the crawler).
- Peer range for jobs `>=0.0.0 <0.2.0`: accepts the workspace 0.0.0 now and 0.1.x once jobs is released.
- Dedup key from the paths, not a run id: a publish has no stored run id, and the same addresses are the same work.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Shared IndexNow target, queue detection, handler and enqueue

#### Automated
- [ ] 1.1 Handler and enqueue tests pass
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: CLI and report

#### Automated
- [ ] 2.1 CLI tests with the queue pass, existing CLI tests unchanged
- [ ] 2.2 Gates green (typecheck, lint, test)

### Phase 3: Docs and gates

#### Automated
- [ ] 3.1 README and CHANGELOG describe the opt-in; build and all gates green
