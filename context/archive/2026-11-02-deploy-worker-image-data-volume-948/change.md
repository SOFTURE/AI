---
change_id: deploy-worker-image-data-volume-948
title: "deploy: a job worker on its own image and a data volume shared by the app and the worker (issue #948)"
status: archived
roadmap_item: null
issue: 948
branch: claude/project-thread-6df7uf
created: 2026-11-02
updated: 2026-11-02
archived_at: 2026-11-02
---

## Intent

Close [issue #948](https://github.com/SOFTURE/AI/issues/948). `softure-deploy init` builds one image and runs the
`worker` service from it, and declares a volume for Postgres only. A worker that needs heavy tools (ffmpeg, Chromium on
glibc) and an app that keeps files on a local disk (`@softure-ai/files` `createLocalStorage`) cannot deploy without
editing the generated files. Take the issue's four proposals:

1. a worker image of its own (`init --worker-dockerfile=<path>`, built and pushed by `deploy-app.yml` next to the app
   image, same tag), which the `worker` service runs;
2. `init --data-volume=<mount path>`: one named volume mounted at the same path in `app` and `worker`, writable by the
   non-root user, known to `checkSharedHostCompose`;
3. resource limits for the worker (`--worker-cpus`, `--worker-memory`, `--worker-tmpfs`);
4. chosen folders of the data volume in the backup next to the database dump (`deploy.json` `data.backupPaths`), and
   the volume's free space checked through the health route verify already asks.

## Context

Labels: `enhancement`, `pkg: deploy`. Issues #956 (speech) waits for this change (its worker needs ffmpeg). No
release in this change: the coordinator releases in the next combined release (and bumps `deploy-cli-version` in the
callers then). Without any new flag or key, the generated files and the workflow behave exactly as before.

## Constraints

- No change in the output of `init` without the new flags (the e2e app and every existing test stay as they are).
- Shell stays within bash 3.2 and BSD/GNU-common flags (AGENTS.md).
- Nothing in an app's repository changes; the README carries the migration steps.

## Notes

- Framing: skipped. The issue names the problem and the solution for each part.
