---
change_id: ops-build-info-878
status: in_progress
---

# Plan: build info and the deploy smoke check (issue #878)

Input: change.md, research.md. Complexity: medium (two packages, the deploy action and two workflows, templates).

## Phase 1: ops build info (TDD)

Files: `modules/ops/src/server/build-info.ts`, `src/server/index.ts`, `src/next/build-info-route.ts`,
`src/next/index.ts`, `src/build/with-build-info.ts` + `src/build/index.ts` (new export `./next-config`), `src/contract.ts`,
`package.json`, tests.

1. `readBuildInfo(options)`: `{ release, commit, builtAt, startedAt }`; release from `SOFTURE_RELEASE` at call time,
   commit and build time from `SOFTURE_BUILD_COMMIT` / `SOFTURE_BUILD_TIME` (literal reads, so Next inlines them) or
   the options; empty is `null`; `startedAt` is the process start.
2. `createBuildInfoResponse(options)`: JSON, `no-store`; with a `changelog` provider adds `changelog` (`null` and a log
   line when the provider fails).
3. `createBuildInfoRoute(options)` in `./next`: `connection()` + the response.
4. `withBuildInfo(nextConfig, options)` in `./next-config`: sets `env.SOFTURE_BUILD_COMMIT` (option, env,
   `GITHUB_SHA`, `git rev-parse HEAD`) and `env.SOFTURE_BUILD_TIME` (now); keeps the app's own `env`.

## Phase 2: deploy CLI (TDD)

Files: `tools/deploy/src/smoke/*`, `src/cli/smoke-command.ts`, `src/cli/changelog-command.ts`, `src/cli/run.ts`,
`src/notes/changelog.ts`, tests.

1. `softure-deploy smoke <url> --tag=<tag> [--commit=<sha>] [--deployed-at=<iso>] [--path=/api/health/build]
   [--headers-file=<file>] [--timeout=<ms>] [--tolerance-seconds=60]`: one GET, prints a check table, exit 1 when the
   release is not the tag, the commit is not the tag's, or the start is older than the deploy.
2. `softure-deploy changelog [--roadmaps=2] [--out=<file>]`: the open roadmap and the newest archived ones, their
   `done` / `done_code` items (id, change id, status) as JSON.

## Phase 3: the action, the workflows and the templates

1. Action: `sent-at` output (taken right before the ssh send); inputs `build-info-path`, `build-info-headers`,
   `deployed-at`; a checkout of the tag to read its commit and a "Check the build info" step that runs the CLI and
   writes `Smoke check: passed/failed` to the job summary; the report's verify result counts it.
2. `deploy-app.yml`: input `build-info-path` (validated), `SOFTURE_BUILD_COMMIT` build argument (a caller's own is
   refused), deploy job output `sent-at`, verify (and the e2e verify) pass `build-info-path` and `deployed-at`.
   `deploy-release-image.yml` passes the same build argument.
3. Templates: `SOFTURE_RELEASE: ${TAG}` in the app service, `ARG SOFTURE_BUILD_COMMIT` before `npm run build`;
   regenerate `tools/deploy/e2e/app`.
4. Example app: `app/api/health/build/route.ts`, `withBuildInfo` in `next.config.ts`, the Dockerfile's arg, an e2e
   spec; `e2e-deploy.yml` sets `build-info-path`, so the smoke runs end to end.
5. Repository tests for the new workflow and action wiring, a bash run of the smoke step with a stub CLI.

## Phase 4: docs

ops README (build info section, env vars), deploy README (smoke, changelog), both CHANGELOGs under `## Unreleased`.

## Decisions (auto)

- The smoke CLI takes the URL as a positional argument like `verify`, not `--url`.
- Headers reach the CLI through a file (`--headers-file`), never its command line; on the action only, like
  `health-headers`.
- Route path suggested `/api/health/build` (under the health prefix an access proxy already lets through); the
  manifest's `mount` stays the health route, the build info route is optional.
- The changelog carries ids, change ids and status only (the route is public): no outcomes.
- The commit check accepts a short build commit (7+ hex) that prefixes the tag's commit.
- No version bump: the coordinator releases (`deploy-cli-version` defaults follow in the release).
- MCP `get_server_info` is left for the follow-up after #877.

## Progress

- [ ] Phase 1: ops build info
- [ ] Phase 2: deploy CLI
- [ ] Phase 3: action, workflows, templates, example app
- [ ] Phase 4: docs
- [ ] Implementation review
