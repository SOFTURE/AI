---
change_id: jobs-worker-heartbeat-610
status: archived
---

# Plan: a heartbeat for the jobs worker (issue #610)

Input: change.md, research.md. Complexity: medium (two packages, a new option, a new check, an init fact).

## Phase 1: jobs heartbeat and check (TDD)

Files: `modules/jobs/src/worker/run-job-worker.ts`, `modules/jobs/src/worker/process.ts`, new
`modules/jobs/src/worker/health.ts`, `modules/jobs/src/worker/index.ts`, `modules/jobs/tests/worker.test.ts`.

1. Tests first:
   - `runJobWorker({ healthFile })` writes the file after a round and keeps its mtime fresh; removes a stale file at
     start (absent until the first round); removes it after a clean stop; without `healthFile` writes nothing;
   - a round whose claim fails (closed database) does not refresh the file;
   - `checkJobWorkerHealth({ healthFile, maxAgeMs, now })`: missing → `{ ok: false, reason: "missing" }`, older than
     the limit → `"stale"` with its age, fresh → ok;
   - `getJobWorkerHealthMaxAgeMs(config)`: 30 s at the default poll interval, 5 × poll interval above 6 s;
   - `runJobWorkerProcess({ argv: ["--health"], healthFile })` returns 0 for a fresh file and 1 for a missing one,
     without opening a database; `--health` without `healthFile` returns 1 and says why.
2. `health.ts`: `checkJobWorkerHealth`, `getJobWorkerHealthMaxAgeMs`, `touchHealthFile`, `removeHealthFile` (write the
   ISO time; errors logged once per kind, never fatal).
3. Loop: remove at start, touch after a round whose claims all succeeded, remove after stop.
4. Process: `healthFile`, `healthMaxAgeMs`, `argv` (default `process.argv.slice(2)`); `--health` checks and returns.

## Phase 2: deploy init uses the check when jobs has it (TDD)

Files: `tools/deploy/src/init/app-facts.ts`, `tools/deploy/src/init/generate.ts`, the worker and compose templates,
their tests.

1. Tests first: `readAppFacts` reads the installed jobs version (node_modules), else the range's lowest version;
   `hasWorkerHeartbeat` true from 0.1.3; with it `scripts/worker.ts` passes `healthFile` and the compose check is
   `["CMD", "node", "worker.mjs", "--health"]`; without it both stay as before.
2. Implementation: `jobsVersion?: string | null` fact, `JOBS_HEARTBEAT_VERSION = "0.1.3"`, template sections.

## Phase 3: docs

`modules/jobs/README.md` ("Running the worker": the heartbeat, `--health`, what Docker does with it),
`modules/jobs/CHANGELOG.md` and `tools/deploy/CHANGELOG.md` `## Unreleased` with the app's migration steps,
`tools/deploy/README.md` ("Job worker").

## Decisions (auto)

- Option 1 of research.md: one entry answers `--health`, so path and limit are shared.
- A round counts only when every claim reached the database: a worker that lost its database is not healthy.
- Default age limit `max(5 × pollIntervalMs, 30 s)`: room for a slow round and an hourly prune at the default poll.
- Health file path in the template: `/tmp/softure-jobs-worker.alive` (writable by the image's user, gone with the
  container).
- Gate on jobs `0.1.3`: every jobs release after 0.1.2 is cut from a master with this change (research.md).

## Progress

- [x] Phase 1: jobs heartbeat and check (c81f1c3)
- [x] Phase 2: deploy init uses the check (92b4d84; PR #611's branch merged in first, a338f91, since it changes the
  same compose block and merges before this one)
- [x] Phase 3: docs (61dffb6)

The new tests were red before each phase's code (missing exports, then the old template). Gates: typecheck, lint,
jobs tests (106), deploy tests (769), repository tests (551).
