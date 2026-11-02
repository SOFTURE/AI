---
change_id: deploy-worker-image-data-volume-948
status: done
---

# Research: worker image, data volume, limits, data backup

## Where the pieces are

- `tools/deploy/src/cli/init-command.ts` reads the flags, `src/init/answers.ts` narrows them (zod, narrow patterns:
  every value lands in YAML or bash unquoted), `src/init/generate.ts` renders `templates/` with booleans and strings
  (`render-template.ts`: `{{key}}`, `{{#key}}`, `{{^key}}`, section tags alone on a line).
- `templates/docker/prod/docker-compose.yml.tmpl`: `worker` uses `{{image}}:${TAG}`, `command: node worker.mjs`, a
  heartbeat health check, `stop_grace_period`; top-level `volumes:` is split by own Traefik / database.
- `templates/Dockerfile.tmpl`: the runner stage creates `nextjs` (uid 1001, group `nodejs`) and copies `worker.mjs`.
- `templates/docker/server/deploy.sh.tmpl`: `IMAGE` is fixed at init; `pull` pulls `$IMAGE:$TAG` (with the release's
  registry token when given); `images` in maintain removes old tags of `$IMAGE`; `back_up_database` runs in the deploy
  (step `backup`) and in maintain. Settings come from `server-settings` (one file per setting).
- `.github/workflows/deploy-app.yml`: `check` validates inputs (`expect_path`), `build` builds one image with
  `docker/build-push-action` (push, or a tar for e2e), or re-tags `prebuilt-image`. The release JSON for the deploy
  action holds `image`, not a worker image; the server never needs it (deploy.sh knows its images).
- `src/testing/shared-host-compose.ts`: `checkSharedHostCompose(yaml, options)` checks networks, ports, labels; it
  does not look at volumes.
- `src/verify/schema.ts` (zod → `schema/deploy.schema.json`, `npm run schema`, a test compares) and
  `src/cli/server-settings-command.ts`.
- `@softure-ai/files` health check fails below `health.minFreeBytes` (local disk); with `@softure-ai/ops` it is part
  of `/api/health`, which init's `deploy.json` already verifies for `"status":"ok"`.

## Findings

- A named volume mounted on an image folder that exists and is owned by uid 1001 gets that owner on its first mount;
  both images must create the folder (`mkdir` + `chown`) before `USER`.
- A worker image on Debian needs its own builder on glibc for native modules; the app image stays alpine.
- `prebuilt-image` re-tags one tested image; a worker image built next to it has no digest input yet, and the e2e path
  hands one tar to the deploy job. Both are refused with `worker-dockerfile` for now (clear error).
- The backup of data folders can run in the app service (`compose run --rm --no-deps -T app tar …`): the volume is
  mounted there, busybox tar is in alpine.

## Risks

- A second image doubles the build time of a release with a worker image; cache scope per image keeps both warm.
- The data backup is a full tar each time; only chosen (non-rebuildable) folders go in, with the database's retention.
