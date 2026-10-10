# Plan: deploy-integration-artifacts-cache

Input: change.md, issue #368 (research skipped, reason in change.md). Complexity: small (one phase).

## Goal

`deploy-integration.yml` takes `artifact-paths`, `sparse-checkout` and `node-cache`; callers that set none behave as
today except that `npm` downloads are now cached.

## Decisions (auto)

- **`artifact-paths` (string, default empty).** Uploaded by a step "Keep the failure artifacts" as
  `integration-failure`, `retention-days: 7` (the report's), `if-no-files-found: warn`. Condition
  `inputs.artifact-paths != '' && (failure() || steps.suite.outputs.result == 'red')`: the suite step never fails
  (it keeps the exit code), so `failure()` alone would miss a red suite. The step sits before "Fail on a red suite".
  No retention input: the issue asks for a short retention and the report's 7 days fit; simplest.
- **Validation.** Each non-empty line, after an optional leading `!`, with `*` and `?` read as plain characters, must
  pass the same `is_repository_path` as the report inputs (relative, no `..`, no shell characters).
- **`sparse-checkout` (string, default empty).** Passed to both jobs' `actions/checkout` with
  `sparse-checkout-cone-mode: false`; the record job needs only git, so it gets the same lighter checkout. Empty means
  a full checkout (the action ignores the cone flag then). Not validated: `actions/checkout` writes the patterns to
  `.git/info/sparse-checkout`, no shell sees them.
- **`node-cache` (string, default `npm`).** Passed to the test job's `setup-node` as `cache`; accepted values `npm`,
  `yarn`, empty (`pnpm` is not on the runner before `setup-node` runs, so it would fail there). The record job runs
  only `npx` and stays uncached. A caller without `package-lock.json` must now set `""`; the default `setup-command`
  (`npm ci`) needs the lockfile anyway. Documented in the CHANGELOG.
- **Version.** 0.1.9: package.json, lockfile, the three workflows' `deploy-cli-version` default, the README's
  `ls-remote` example, CHANGELOG.

## Phase 1: workflow, tests, docs (test-first)

- Tests in `tests/repo/deploy-workflows.test.ts` (fail on master): the inputs and defaults; both checkouts carry the
  sparse patterns; `setup-node` caches; the upload step's condition, settings and place; the validation accepts globs,
  exclusions and each cache value and refuses an absolute path, `..`, shell characters and `pnpm`.
- Docs: README "Integration workflow", CHANGELOG 0.1.9, the example caller's header.
- Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Progress

- [x] Phase 1: workflow, tests, docs
