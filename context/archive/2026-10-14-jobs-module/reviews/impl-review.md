# Implementation review: jobs-module

Reviewed: commits e2344fb..4585c82 against plan.md. Mode: full. Verdict: ready.
Findings: 0 critical, 0 warning, 3 notes.

## Coverage
| Ask of #471 | Where |
| --- | --- |
| `jobs({ queues })`, own schema and migration | `modules/jobs/src/options.ts`, `migrations/0001_create_jobs.sql` |
| `enqueueJob` inside the caller's transaction, `dedupKey` | `src/server/enqueue.ts`; tests: rollback leaves no job, dedup per queue |
| claim with `FOR UPDATE SKIP LOCKED`, lease expiry, fenced completion | `src/server/claim.ts` (claim token); tests: takeover refuses the stale write, extend and release |
| retry with growing backoff, terminal `failed` | `src/server/backoff.ts`, `src/server/process.ts`; tests: 10 s, 20 s, cap and jitter, `failJob`, `retryJobLater` |
| worker entry with graceful shutdown | `src/worker/`; tests: concurrency, heartbeat, grace, release with the attempt given back |
| test helpers on `createTestDatabase` | `runDueJobs`, `listJobs` in `@softure-ai/jobs/testing` |
| deploy service for the worker | `tools/deploy` init: `scripts/worker.ts`, `worker.mjs`, `worker` service with the health check off |

## Adversarial read
- A released job keeps its attempt count lowered; fencing does not rely on `attempts` but on `claim_token`, so a
  release followed by a new claim cannot let the old worker write. Checked in `claim.ts` (`isHeld`).
- The image `HEALTHCHECK` (port 3000) would mark a worker unhealthy: the service sets `healthcheck: disable: true`;
  asserted in `generate.test.ts`.
- `last_error` stores codes only; a handler's free text is cut to 200 characters and must contain a dot, else it is
  stored as `jobs.handler_threw`. Payload values never reach a log line (paths only on a schema mismatch).
- The worker survives database errors in claim, heartbeat, record and prune (logged, retried next round).

## Notes
- Concurrent `SKIP LOCKED` claiming is not exercised (PGlite has one connection); README §12 says so.
- The first npm publish of `@softure-ai/jobs` needs the `NPM_TOKEN` secret (scripts/release/README.md).
- An app that already ran `softure-deploy init` adds the worker parts by hand or re-runs `init --force`
  (deploy CHANGELOG, Unreleased).

## Gates
typecheck, lint (ESLint + language), build and `npm test` green (6958 passed after the release-tags count moved to 23 packages, a test that counts public packages).
