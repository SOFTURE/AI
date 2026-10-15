# Plan: jobs-module

Input: change.md, research.md (framing skipped, reason in change.md). Complexity: large (five phases).

## Goal

`@softure-ai/jobs` exists in `modules/jobs/` with its schema, migration, enqueue and admin functions, the job
processor, the worker loop and process entry, test helpers and a README; `softure-deploy init` adds the worker
container to an app that depends on it. All gates green.

**Out of scope:** refactoring billing, mailing and blog onto the queue (follow-up issues after the merge); a release.

## Approach

Chosen: one table per app (`jobs.jobs`), claim with `FOR UPDATE SKIP LOCKED`, `attempts` as the fencing token, a
polling worker in its own process. Rejected: `LISTEN/NOTIFY` wake-ups (needs a dedicated connection and adds little
over a one-second poll at this scale; can come later behind the same API); a table per queue (configurable table
names are forbidden by the module standard §4); bundling a third-party queue (pg-boss, graphile-worker: own schema
management outside the SOFTURE migrator and ledger).

## Phase 1: Package, schema and options

**Discipline:** TDD. **Files:** `modules/jobs/{package.json,module.json,tsconfig*.json,CHANGELOG.md,README.md}`,
`migrations/0001_create_jobs.sql`, `src/{index,options,contract,schema}.ts`, `src/messages/`, `src/server/options.ts`,
`tests/{support,module}.test.ts`.

- Copy `templates/package/`, drop `next/` and `ui/`; entries `.`, `./server`, `./worker`, `./testing`.
- Options: `queues` (name → `maxAttempts`, `backoff { baseSeconds, maxSeconds }`, `leaseSeconds`, `concurrency`),
  `pollIntervalMs`, `retention { succeededDays, failedDays, cancelledDays }`, `shutdownGraceMs`.
- Health check: one cheap query on `jobs.jobs`.

Done when: module and constraint tests pass; `module.json` equals the manifest.

## Phase 2: Enqueue, processing and test helpers

**Discipline:** TDD. **Files:** `src/server/{enqueue,admin,claim,process,handlers,backoff,prune,stats}.ts`,
`src/testing/index.ts`, tests.

- `enqueueJob(db, config, { queue, payload, runAt?, delaySeconds?, dedupKey?, maxAttempts? })` on a `Queryable`.
- `cancelJob`, `retryJob`, `getJob`, `getQueueStats`, `pruneJobs`.
- `claimJobs`, `processClaimedJob` (fenced completion: succeeded, retried with backoff, failed), `releaseJob`.
- `defineJobHandler`, `failJob`, `retryJobLater`.
- `runDueJobs({ db, config, handlers, clock })` in `@softure-ai/jobs/testing` (also on `./server`).

Done when: tests cover success, retry with backoff, terminal failure, invalid payload, thrown handler, dedup inside
a transaction and after rollback, lease expiry with and without attempts left, stale completion refused, cancel,
retry, prune, stats.

## Phase 3: Worker loop and process entry

**Discipline:** TDD. **Files:** `src/worker/{index,run-job-worker,process}.ts`, tests.

- `runJobWorker({ db, config, handlers, signal, logger?, clock?, workerId?, random? })`: claims per queue up to its
  concurrency, heartbeats leases, prunes hourly, stops claiming on abort, waits `shutdownGraceMs`, releases the rest.
- `runJobWorkerProcess({ config, handlers })`: SIGTERM/SIGINT → abort, opens the database with `openCommandDatabase`,
  closes it, resolves to the exit code and sets `process.exitCode`.
- Refuses a handler for a queue the options do not define, and a configured queue without a handler is logged once.

Done when: worker tests (real timers, short intervals) cover processing, concurrency, shutdown release, heartbeat.

## Phase 4: Worker container in `softure-deploy init`

**Discipline:** TDD. **Files:** `tools/deploy/src/init/{app-facts,generate}.ts` and tests,
`tools/deploy/templates/{Dockerfile.tmpl,docker/prod/docker-compose.yml.tmpl,scripts/worker.ts.tmpl}`, README,
CHANGELOG.

- Fact `hasJobs` (`@softure-ai/jobs` in dependencies, with a database); template value `jobs`.
- Dockerfile bundles `scripts/worker.ts` into `worker.mjs` and copies it; compose gets a `worker` service.

Done when: generate tests show the worker parts only with `@softure-ai/jobs`; `e2e/app` stays byte for byte (the
example app does not use jobs); deploy tests green.

## Phase 5: Docs and gates

**Discipline:** test-after. **Files:** `modules/jobs/README.md` (12 fixed sections), root `README.md` package list,
`docs/` mentions where packages are listed.

Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Risks and rollback

- New package, nothing depends on it: rollback is reverting the merge. The deploy change only renders for apps
  with `@softure-ai/jobs`, so existing apps get byte-identical files.

## Decisions (auto)

- Package name `@softure-ai/jobs`, schema `jobs`, table `jobs` (as the issue proposes).
- Dedup covers pending and running jobs only; a finished job frees its key.
- `last_error` stores an error code, never a message or stack (payload data must not leak into it); details go to
  the logger.
- Logger: a structural interface compatible with `@softure-ai/observability`'s `Logger`, console by default, so the
  package has no OpenTelemetry dependency.
- A job released on shutdown gets its attempt back; a lease that expired counts as a used attempt.
- No GDPR contributor: payloads are transient and pruned; the README says to keep personal data out of payloads
  (ids only).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Package, schema and options

#### Automated
- [x] 1.1 Module, options and table constraint tests pass — e2344fb
- [x] 1.2 Gates green (typecheck, lint, test) — e2344fb

### Phase 2: Enqueue, processing and test helpers

#### Automated
- [x] 2.1 Enqueue, processing, lease, fencing, admin and prune tests pass — d82662f
- [x] 2.2 Gates green (typecheck, lint, test) — d82662f

### Phase 3: Worker loop and process entry

#### Automated
- [x] 3.1 Worker loop, shutdown and process entry tests pass — f6755ca
- [x] 3.2 Gates green (typecheck, lint, test) — f6755ca

### Phase 4: Worker container in softure-deploy init

#### Automated
- [x] 4.1 Init renders the worker parts only for apps with @softure-ai/jobs; e2e app unchanged — 4585c82
- [x] 4.2 Gates green (typecheck, lint, test) — 4585c82

### Phase 5: Docs and gates

#### Automated
- [x] 5.1 README with the 12 sections, package lists updated — 0025a52
- [x] 5.2 Gates green (typecheck, lint, test, build) — 0025a52
