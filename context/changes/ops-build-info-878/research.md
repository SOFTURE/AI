---
change_id: ops-build-info-878
---

# Research: build info and the deploy smoke check (issue #878)

Read on master 90e8bad.

## What exists

- `modules/ops`: `GET /api/health` (`src/next/route.ts` = `connection()` + `createHealthResponse(config)` from
  `src/server/health-response.ts`), `no-store`, no Next import in `./server`. Exports `.`, `./server`, `./next`,
  `./scripts`; `tests/repo/packages.test.ts` checks each code export as source, types, default.
- `.github/actions/deploy/action.yml`: render, pack, send (`ssh … | tee`, `result|ok`), the health wait (`health-status`,
  `health-headers` through a 0600 header file, masked), the `deploy.json` routes (`softure-deploy verify`), the
  report (`VERIFY_RESULT` from the health and routes outcomes). `tools/deploy/tests/health-wait.test.ts` runs a step's
  `run` with bash and a stub `curl`.
- `.github/workflows/deploy-app.yml`: `check` validates every input and emits `release` (JSON) and `sha` (the tag's
  commit); `build` runs `docker/build-push-action` with `build-args: ${{ inputs.build-args }}`; `deploy` and `verify`
  run the action from `job.workflow_sha`; the e2e path runs the verify half inside the deploy job.
  `tests/repo/deploy-workflows.test.ts` checks its shape and runs its validate step;
  `deploy-cli-version` defaults must equal `tools/deploy/package.json`'s version (a release bumps both).
- `deploy-release-image.yml` builds an image from a full SHA (`inputs.ref`) for the `prebuilt-image` path.
- The release tag reaches the server: deploy.sh writes `TAG=<tag>` into `.env.prod`, and the compose file of `init`
  uses `${TAG}` for the image only; the app container does not see it.
- `init`'s `Dockerfile.tmpl` and `examples/next-app/Dockerfile` run `npm run build` in a builder stage, no commit
  arg; `.git` is not in the build context of a GitHub build, so the commit has to come as a build argument.
- `tools/deploy/src/notes/roadmap-items.ts` parses a roadmap's `## At a glance` table (id, change id, status as the
  last cell); `roadmap-files.ts` knows `context/foundation/roadmap.md` and the archive naming and order.
- `e2e-deploy.yml` deploys the example app (`examples/next-app/Dockerfile`) through `deploy-app.yml` with
  `e2e: true`, tag = the PR head SHA, on every PR touching the deploy files: a full run of a new smoke step is
  possible there. `e2e.yml` builds the example app with `next build` and runs its Playwright specs.

## Findings

- Next's `env` in `next.config` replaces `process.env.NAME` at build time in bundled code; ops is not in the example
  app's `serverExternalPackages`, so a literal `process.env.SOFTURE_BUILD_COMMIT` read inside the package should be
  inlined. To be measured in the example app's e2e (a spec that expects a commit); the route also takes explicit
  values, so an app with ops externalized passes them from its own route file.
- Process start: `Date.now() - process.uptime() * 1000` is the process start whatever loads the module when.
- The runner's clock and the server's differ by NTP skew at most; a tolerance (60 s) on the start-time check keeps a
  real stale container (minutes to days old) failing.

## Options

- Commit by build argument `SOFTURE_BUILD_COMMIT` set by the workflow (both build paths) and declared in the
  Dockerfiles, falling back to `GITHUB_SHA` and `git rev-parse HEAD` for a local or CI build: chosen.
- Release by `SOFTURE_RELEASE: ${TAG}` in the app service of init's compose file (read per request): chosen.
- Smoke headers in `deploy-app.yml` as a secret: not taken; `health-headers` exists only on the action too, and the
  route is meant to live under a prefix an access proxy bypasses.
