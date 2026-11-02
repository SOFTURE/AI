---
change_id: deploy-worker-image-data-volume-948
status: in_progress
---

# Plan: worker image, data volume, worker limits, data backup (issue #948)

Input: change.md, research.md. Complexity: medium (init flags and templates, workflow, server script, guard, docs).

## Phase 1: init flags and templates (tests first)

Files: `src/init/answers.ts`, `src/init/generate.ts`, `src/cli/init-command.ts`, `templates/Dockerfile.tmpl`,
`templates/docker/prod/docker-compose.yml.tmpl`, `templates/worker.Dockerfile.tmpl` (new),
`templates/.github/workflows/deploy.yml.tmpl`, `templates/docker/server/deploy.sh.tmpl`, tests.

1. Answers: `workerDockerfile` (relative path, no `..`), `dataVolume` (absolute path of plain segments, not `/` and
   not `/app` itself), `workerCpus` (`0.5`, `2`), `workerMemory` and `workerTmpfs` (`512m`, `2g`). The worker flags are
   refused when the app has no worker part.
2. Compose: worker `image: {{image}}-worker:${TAG}` with a worker image; `cpus`, `mem_limit`, `tmpfs: /tmp:size=…`;
   `app-data:{{dataVolume}}` on app and worker, `app-data:` in top-level volumes.
3. Dockerfile: `mkdir` + `chown nextjs:nodejs` of the data folder before `USER`.
4. Worker Dockerfile (written at the given path when absent): glibc builder bundling `scripts/worker.ts`, a runtime
   stage from `WORKER_BASE_IMAGE` (default `node:22-trixie-slim`), user 1001, the data folder.
5. Caller `deploy.yml`: `worker-dockerfile:` input.
6. deploy.sh: `WORKER_IMAGE`; `pull` pulls both; `images` cleans both.

## Phase 2: deploy-app.yml

`worker-dockerfile` input (default empty); check validates the path and refuses it with `prebuilt-image` or `e2e`;
build pushes `<image>-worker:<tag>` with the same build args and its own cache scope; outputs `worker-image` and
`worker-digest`. Tests in `tests/repo/deploy-workflows.test.ts`.

## Phase 3: data backup and guard

1. `deploy.json` `data.backupPaths` (relative paths of plain segments) → server setting `data-backup-paths`; schema
   regenerated.
2. deploy.sh (database and data volume on): after each database backup, `tar` of the listed folders from the app
   service into `backups/data-<stamp>.tar.gz`, newest `BACKUP_KEEP` kept; a failure fails the backup.
3. `checkSharedHostCompose` option `dataVolume: { mountPath }`: `app` and `worker` (when present) mount one named
   volume there (`data-volume-missing`, `data-volume-bind`, `data-volume-split`).

## Phase 4: docs

README (worker image with marketing-kit's `footage-worker.Dockerfile` as the base, data volume and
`createLocalStorage({ root })`, limits, data backup, free space through the health route, guard option), CHANGELOG
`## Unreleased`.

## Decisions (auto)

- Worker image name `<image>-worker`, same tag: one rule the workflow, compose file and deploy.sh share, no new input
  for the name.
- `prebuilt-image` and `e2e` with `worker-dockerfile` are refused, not half-supported.
- init writes a starter worker Dockerfile at the path when it is missing (the app owns it after), like every init file.
- Free space: no new verify check; the `files` health check inside `/api/health` already fails below the floor, and
  init's deploy.json verifies that route. Documented.
- Data backup lives under `data.backupPaths` in deploy.json (release-time setting, like the database ones) and runs
  only with the database part, where the backup step is.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
- [ ] Phase 4
