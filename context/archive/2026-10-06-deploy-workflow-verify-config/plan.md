# Plan: deploy-workflow-verify-config

Input: change.md, research.md. Complexity: low (one workflow job, one input, a repository test, README lines).

## Goal

The `verify` job of `deploy-app.yml` waits for the health route, then runs `softure-deploy verify <app-url>` with the
app's `deploy.json` from the release tag; `deploy-config: ""` keeps the health route only.

**Out of scope:** the `verify` schema and engine (`tools/deploy/src/verify/`, DF-5 and DF-6), shipping server files
(DF-7), running the workflow end to end (DF-3), the publish and the caller tag (DP-8).

## Approach

**Chosen:** a new input `deploy-config` (default `deploy.json`, empty = health only), validated in `check` like the
other paths. The `verify` job (`permissions: contents: read`) keeps the health wait as its first step, then, when the
input is set, checks out only `/<deploy-config>` at the tag without credentials, sets up Node and runs
`npx --yes --package=@softure-ai/deploy@<deploy-cli-version> softure-deploy verify "$APP_URL" --config="$DEPLOY_CONFIG"`,
every value through `env:`. The CLI's own exit codes and messages decide the result (missing file, invalid config,
failed route).
**Rejected:** falling back to the health route when the file is missing (a release would read as verified with its
checks skipped); a separate job (a second runner and checkout for one command, and the health wait must precede it);
the whole tag checked out (the app's `.npmrc` would steer `npx`).

## Phase 1: Verify with the app's config

**Discipline:** test-first (the repository test is extended and red before the workflow changes).
**Files:** `tests/repo/deploy-workflows.test.ts`, `.github/workflows/deploy-app.yml`, `tools/deploy/README.md`.

1. Test: `deploy-config` defaults to `deploy.json`, the file `softure-deploy init` writes; the `verify` job's first
   step polls the health route; a later step runs `softure-deploy verify` with `--config`, guarded by the input; its
   checkout is at the tag, sparse to the anchored config path, without persisted credentials.
2. Workflow: the input, its check (`expect_path` when not empty), the job steps above, the header comment.
3. README: deploy workflow step 4 and the inputs table; remove the DF-2 limitation line.
4. Gates: typecheck, lint, test, build; actionlint 1.7.12 with shellcheck over the workflows and the example caller.
   The `check` script and the verify step are run by hand: valid and invalid `deploy-config` values, and the CLI from
   the checkout against a local HTTP server with a passing and a failing `deploy.json`, and with none.

## Progress

#### Automated
- [x] Phase 1: verify with the app's config (test red before the workflow, then green)

#### Manual
- [ ] DP-8 (owner): the first publish of `@softure-ai/deploy` and the `deploy-workflows-v1` tag; until then the
  workflow cannot run.
