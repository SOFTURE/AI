---
change_id: jobs-worker-heartbeat-610
---

# Research: a heartbeat for the jobs worker

## Current behaviour

- `modules/jobs/src/worker/run-job-worker.ts`: the loop runs rounds until aborted. Each round enqueues due schedule
  runs, claims per queue (`claimJobs`), prunes once an hour, then waits up to `pollIntervalMs` (default 1000, max
  60 000) or until a finished job wakes it. Database errors in a round are logged and the loop goes on, so a round
  ends even while the database is down; a hung query keeps the round from ending.
- `modules/jobs/src/worker/process.ts`: `runJobWorkerProcess({ config, handlers })` opens a pool, maps SIGTERM/SIGINT to
  an abort, runs the loop and returns an exit code. An app's `scripts/worker.ts` calls it; deploy bundles it into
  `worker.mjs`.
- `tools/deploy`: `templates/scripts/worker.ts.tmpl` calls `runJobWorkerProcess({ config, handlers })`;
  `templates/docker/prod/docker-compose.yml.tmpl` gives the `worker` service `healthcheck: disable: true` on master,
  `node -e "process.kill(1, 0)"` after PR #611. `src/init/app-facts.ts` reads `hasJobs` from package.json only; no
  installed version is read today. Templates support `{{#key}}` and `{{^key}}` sections.
- Nine packages depend on jobs with `^0.1.x`, so its next release is a patch (`0.1.3`) or later: every jobs version
  after 0.1.2 is released from a master that has this change.

## Options

1. **Heartbeat file + `--health` in the same entry** (chosen): `runJobWorker({ healthFile })` writes the file after
   each round whose claims reached the database; `runJobWorkerProcess` answers `--health` (argv) with a check of the
   file's age instead of running, so the image runs `node worker.mjs --health`. Shares the path and the age limit
   with the writer, needs nothing but node.
2. Inline `node -e` that stats the file in the compose file: no jobs code for the check, but the age limit and the
   path are duplicated in the app's compose file, and the issue asks for a jobs-level check.
3. A database-backed heartbeat (a row per worker): proves the database too, but needs a migration and a connection per
   check every 10 s. Out of proportion.

## Decisions to make in the plan

- What a round must do to count: claims of every queue succeeded (the database answered). A round in which claiming
  failed does not touch the file, so a worker that lost its database turns unhealthy after the age limit.
- The age limit: `max(5 × pollIntervalMs, 30 s)` by default, overridable.
- Stale file from a previous run of the same container: removed at start, so the check fails until the first round.
- Gating in deploy: read the installed `node_modules/@softure-ai/jobs/package.json` version (else the lowest version
  of the app's range); 0.1.3 or later gets the heartbeat, anything older (or unknown) keeps the PID 1 check.

## Risks

- Plain Docker does not restart an unhealthy container (only `up --wait`, Swarm or an autoheal sidecar act on it);
  the README must say what the check gives: a deploy that waits for a loop that really runs, and an unhealthy status
  an operator or monitor sees.
- `node worker.mjs --health` loads the whole bundle (config, handlers) each check; config reads the same environment
  as the worker, so it starts. It must not open a database or start a loop.
