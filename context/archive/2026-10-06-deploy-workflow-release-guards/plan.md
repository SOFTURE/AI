# Plan: deploy-workflow-release-guards

Input: change.md, research.md. Complexity: medium (one workflow, two callers, the server script around the pull, the
e2e recorder, tests, README).

## Goal

`deploy-app.yml` refuses a tag off the release branch before anything is built; bakes `build-args` into the image and
refuses a release whose `.env.prod` holds another value under a build argument's name; renders `app-vars` over
`app-secrets`; and ships the deploy job's `GITHUB_TOKEN` as `.registry-token` in the release archive, which
`deploy.sh` uses to pull through a throwaway Docker config.

**Out of scope:** a tag pattern (FIRE's dates stay in the app; DF-12 cuts tags); pinning the build to the commit the
guard checked (a tag moved between jobs needs push rights, which already deploy); the server's other safety steps
(DF-9); the report job (DF-10).

## Approach

**New inputs:** `release-branch` (string, default `""` = the caller's default branch), `build-args` (string, newline
`NAME=value` list, default `""`), `app-vars` (string, JSON object, default `"{}"`), `registry-token` (boolean, default
`true`).

- `check`: validates `release-branch` (a branch name: letters, digits, `._/-`, no `..`) and each `build-args` line
  (`NAME=value`, a name once). New steps: a checkout of the tag (`fetch-depth: 0`, `filter: tree:0`, only the compose
  file, no credentials) and "Refuse a tag off the release branch": resolves the tag to a commit, picks
  `release-branch` or `DEFAULT_BRANCH`, requires `origin/<branch>` and `git merge-base --is-ancestor`, each refusal an
  `::error::` naming tag, commit and branch. The job gets `contents: read`.
- `build`: `build-args: ${{ inputs.build-args }}`.
- `deploy` (`packages: read` added): the render step reads `APP_VARS` (an object of strings; reserved names refused
  as for secrets) and merges it over the secrets, printing the names taken from `app-vars` that a secret also holds;
  after the CLI wrote `.env.prod`, every build argument whose name is in `.env.prod` must equal the value given to the
  CLI, else the file is removed and the step fails naming the variable only. The pack step adds `.registry-token`
  (0600) when `REGISTRY_TOKEN` is set and reserves the name in the compose folder; the cleanup removes the stage.
- `deploy.sh.tmpl`: after the required-files check, a `.registry-token` member must be a non-empty file; it moves to
  the run's temp folder (never installed), and the pull runs `docker login <registry> --password-stdin` and
  `docker pull` with `DOCKER_CONFIG` in a 0700 folder inside it (stdout of the login silenced; its stderr warning
  about unencrypted storage concerns that throwaway folder). Without the member, the host's login pulls as before. Header
  comments say so.
- Callers: the example and init's template pass `app-vars: ${{ toJSON(vars) }}` and show `build-args` in a comment;
  `e2e-deploy.yml` deploys the pull request's head commit with `release-branch` set to its branch (`github.head_ref ||
  github.ref_name`; a dispatch runs from a branch), passes one `app-vars` value and one `build-args` line, and its `assert` job checks out the same
  commit. `record.sh` leaves `.registry-token` out of the hashes and records its mode; `check-received.sh` expects it
  (0600).

**Rejected:** the GitHub compare API for the branch check (a second code path to stub; git gives the same answer
with commits only); `docker login` into the host's config plus `logout` (removes the owner's own login); refusing a
name in both `app-vars` and `app-secrets` (FIRE keeps `APP_ORIGIN` as both, and `toJSON(vars)` plus
`toJSON(secrets)` is the simple caller); a CLI flag for the comparison (needs a new published CLI for a workflow
check).

## Phase 1: Guards, values and the token

**Discipline:** test-first (the tests below are written and red before the workflow, template and scripts change).
**Files:** `.github/workflows/deploy-app.yml`, `.github/workflows/e2e-deploy.yml`, `tools/deploy/examples/deploy.yml`,
`tools/deploy/templates/.github/workflows/deploy.yml.tmpl`, `tools/deploy/templates/docker/server/deploy.sh.tmpl`,
`tools/deploy/e2e/server/record.sh`, `tools/deploy/e2e/check-received.sh`, `tools/deploy/e2e/app/` (regenerated),
`tests/repo/deploy-workflows.test.ts`, `tools/deploy/tests/{release-guards,server-files,e2e-scripts}.test.ts`,
`tools/deploy/README.md`.

1. Test (`release-guards.test.ts`, new): the guard step against a real git repository and its clone: a tag on the
   branch passes, a tag only on another branch is refused, `release-branch` overrides the default, an unknown branch
   and an unknown tag are refused; the `check` script refuses a bad `release-branch` and bad or repeated `build-args`
   lines; the render step with a stub CLI: `app-vars` win and are listed, a reserved name in `app-vars` is refused,
   a build argument equal to the rendered value passes, a different one fails without printing either value and
   leaves no `.env.prod`, a build argument not rendered is ignored.
2. Test (`server-files.test.ts`): pack with `REGISTRY_TOKEN` puts a 0600 `.registry-token` in the archive; `deploy.sh`
   logs in with it and pulls under a temp `DOCKER_CONFIG`, installs no token anywhere, removes the config; without
   it, no login; an empty token is refused with nothing installed; the pack step refuses a compose-folder file named
   `.registry-token`.
3. Test (`e2e-scripts.test.ts`, `deploy-workflows.test.ts`): the recorder and checker with the token; the e2e caller
   deploys the head commit on its branch; the deploy job has `packages: read`; the new inputs' defaults.
4. Workflow, template, callers, recorder, checker as above; `npm run e2e-app -w @softure-ai/deploy`; README (steps,
   inputs, the server needs no registry login, the limitation for an older `deploy.sh`, DF-11 out of "tracked").
5. `@softure-ai/deploy` stays 0.1.3 (unpublished; the template change rides with it).
6. Gates: typecheck, lint, test, build; actionlint with shellcheck over the workflows; shellcheck over the rendered
   `deploy.sh`.

## Progress

#### Automated
- [x] Phase 1: guards, values and the token (tests red before the change, then green) — d470d34

#### Manual
- [ ] Owner: the release of `@softure-ai/deploy` 0.1.3 (the template change rides with it). An app whose server runs
  a `deploy.sh` from before this change sets `registry-token: false` until that script is replaced.
