# Research: deploy-workflow-release-guards

Read on 2026-10-06: `master` `8a8b157` (`deploy-app.yml`, `e2e-deploy.yml`, `deploy.sh.tmpl`, the init caller
template, `tests/repo/deploy-workflows.test.ts`, `tools/deploy/tests/{server-files,e2e-scripts}.test.ts`,
`e2e/server/record.sh`, `e2e/check-received.sh`) and FIRE_TRACKER (read only): `.github/workflows/release.yml`
(`prepare`, `image`, `deploy`), `src/lib/env-prod.ts`, `scripts/render-env-prod.mts`, `docker/server/gateway.sh`.

## 1. Tag on the default branch

FIRE (`prepare`): a full checkout (`fetch-depth: 0`), then `git merge-base --is-ancestor "$sha" origin/master`, with
an error naming the commit and the tag. Our `check` job has `permissions: {}` and no checkout. It needs
`contents: read` and the history: `actions/checkout` with `fetch-depth: 0` fetches every branch into
`refs/remotes/origin/*` and every tag; `filter: tree:0` keeps it to commits (FIRE's archive folders are hundreds of MB).
The default branch is `github.event.repository.default_branch` (set for `release`, `workflow_dispatch`, `push` and
`pull_request` events; in a called workflow `github` is the caller's).

The e2e caller deploys `github.sha`, which on a pull request is the merge commit: on no branch. To run the guard for
real there, it deploys the pull request's head commit and names the head branch.

## 2. Build arguments and the L-117 comparison

FIRE passes `APP_ORIGIN`, `NEXT_PUBLIC_*` as `build-args` from repository variables, and `renderujEnvProd` refuses
when `APP_ORIGIN`/`APP_DOMAIN` of the build (variables) differ from the rendered runtime value (secret). Generic form:
every build argument whose name is also written into `.env.prod` must hold the same value. `docker/build-push-action`
takes `build-args` as a newline list of `NAME=value` (commas kept). Build arguments land in the image's history, so
they are for public values only.

## 3. Non-secret values

FIRE reads optional names from variables before secrets, because a secret `1` masked every `1` in the Actions log
(`users=***`, measured at v2026.09.29). An input is not a secret, so an `app-vars` input (`toJSON(vars)`) is not
masked. The render step builds the CLI's environment from `app-secrets`; adding `app-vars` over it (same reserved-name
rule) gives FIRE's precedence. FIRE keeps required names secret-only; one rule (values win over secrets, names in
both are listed) is simpler and states which source was used.

## 4. Registry token

FIRE packs `.env.prod` and `ghcr-token` (the deploy job's `GITHUB_TOKEN`, valid until the job ends) into one tar on
stdin; the gateway logs in, pulls and logs out. DF-7's archive already carries `.env.prod`, so the token rides in it
as a second file (answers the unknown). Logging in to the host's own Docker config would overwrite or remove a login
the owner set up; `DOCKER_CONFIG=<temp dir>` for the login and the pull leaves the host config untouched, and the
folder goes with the run's temp folder. The deploy job needs `packages: read` (the build's label links the package to
the repository). A `deploy.sh` older than this change installs any extra file next to itself: the token would land in
`/srv/<app>/` (expired by then). The input `registry-token: false` keeps the old behaviour for such a server.

## 5. Tests that pin today's shape

`deploy-workflows.test.ts` runs `check`'s first step as a script and pins step names, the deploy checkout and
`tag: ${{ github.sha }}` of the e2e caller; `server-files.test.ts` runs the pack step and the generated `deploy.sh`
with a stub `docker`; `e2e-scripts.test.ts` runs pack, `record.sh` and `check-received.sh` and pins the recorded file
list. Each changes with the archive's new member.
