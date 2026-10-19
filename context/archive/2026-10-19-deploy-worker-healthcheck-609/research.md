---
change_id: deploy-worker-healthcheck-609
---

# Research: worker health check (issue #609)

## Where the worker is defined

- `tools/deploy/templates/docker/prod/docker-compose.yml.tmpl`: the `worker` service (rendered with `{{#worker}}`,
  i.e. a database and `@softure-ai/jobs`) runs `node worker.mjs` from the app image with `healthcheck: disable: true`,
  because the image's `HEALTHCHECK` (`Dockerfile.tmpl`) asks the app's HTTP port, which the worker does not serve.
- `tools/deploy/templates/docker/server/deploy.sh.tmpl` starts it with
  `compose up --detach --wait --remove-orphans traefik app worker`.
- `tools/deploy/src/init/generate.test.ts` pins the service, including `healthcheck: { disable: true }`.
- `tools/deploy/README.md` ("Job worker") says `up --wait` then waits for the worker to run, which is no longer true.
- The integration compose file is the app's own; the package generates none. The e2e app has no worker.

## Docker Compose behaviour

With `--wait`, Compose waits for every started service to be `running/healthy`. A service with no health check
counts as ready once it runs, but one whose check is explicitly disabled fails the wait with
"container … has no healthcheck configured" (reported on Compose v5). Giving the service its own `healthcheck.test`
replaces the image's `HEALTHCHECK` for that service.

## Options

1. **PID 1 liveness** (the issue's workaround): `node -e "process.kill(1, 0)"`. Signal 0 only checks that PID 1
   exists and may be signalled; `node worker.mjs` is PID 1 (no `init:`), owned by `nextjs` like the check. Node is in
   the image, so nothing is added. It proves the process runs, which is what `--wait` needs; a dead worker stops the
   container anyway (`restart: unless-stopped`).
2. **Heartbeat from `@softure-ai/jobs`** (a file the loop touches, or a `health` command): proves the loop runs, but
   is a new feature of another package (option, file path, tests, release of jobs) and the deploy template would
   depend on a jobs version. Out of this bug's scope.

## Recommendation

Option 1 in the template, with an interval and start period matching the issue; option 2 filed as a separate
enhancement issue for `@softure-ai/jobs`.
