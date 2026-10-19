---
change_id: deploy-worker-healthcheck-609
status: open
---

# Plan: worker health check (issue #609)

Input: change.md, research.md. Complexity: small (one template, one test, docs).

## Phase 1: the template (TDD)

Files: `tools/deploy/src/init/generate.test.ts`, `tools/deploy/templates/docker/prod/docker-compose.yml.tmpl`.

1. Test first: the `worker` service carries
   `healthcheck: { test: ["CMD", "node", "-e", "process.kill(1, 0)"], interval: "10s", timeout: "5s", retries: 3,
   start_period: "10s" }` and no `disable`.
2. Replace `disable: true` in the template; update the comment above the service.
3. Check by hand that the rendered check passes inside a running `node` container as a non-root user and fails once
   PID 1 is gone (where Docker is available; otherwise run the same `node -e` as PID 1 of a namespace-less process).

## Phase 2: docs

`tools/deploy/README.md` ("Job worker"), `tools/deploy/CHANGELOG.md` `## Unreleased` with the app's migration: the
same block in `docker/prod/docker-compose.yml` and in its own integration compose file. File the jobs heartbeat
enhancement as its own issue.

## Decisions (auto)

- PID 1 liveness, not a jobs heartbeat → the bug needs `--wait` to pass; a heartbeat is a feature of another package
  and gets its own issue.
- `start_period: 10s`, `interval: 10s`, `timeout: 5s`, `retries: 3` → the issue's values, proven in an adopting app.

## Progress

- [ ] Phase 1: the template
- [ ] Phase 2: docs
