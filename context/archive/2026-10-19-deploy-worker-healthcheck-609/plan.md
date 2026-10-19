---
change_id: deploy-worker-healthcheck-609
status: archived
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

- [x] Phase 1: the template (9d5b1c1)
- [x] Phase 2: docs (54c6318)

The changed `generate.test.ts` case was red against the old template. Checked by hand with Docker Compose 5.6.0 and an
image whose own `HEALTHCHECK` always fails, running as a non-root user: with the new check `up --wait` reports the
worker healthy (the service's check replaces the image's); a worker whose process exits fails `up --wait`. The
"has no healthcheck configured" failure itself did not reproduce on 5.6.0 with `disable: true`, so it depends on the
Compose release the adopting app runs; the new check passes either way. The jobs heartbeat is filed as #610. Gates:
typecheck, lint, the deploy package's tests (767 passed).
