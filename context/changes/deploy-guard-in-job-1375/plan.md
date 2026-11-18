# Plan: deploy-guard-in-job (#1375)

## Approach

One boolean input `guard-in-job` per workflow. The guard steps of the guard job become anchors whose `if:` also holds
in the work job when the input is on; the work job runs them first, then empties the workspace again, then checks out
the resolved commit. Job conditions and outputs fall back to the work job's step outputs when the guard job was
skipped.

## Phases

### Phase 1: workflows and tests (test-first)

- `tests/repo/deploy-workflows.test.ts`: the input exists with default false in both; with it off the job graph,
  conditions and checkouts are unchanged in meaning; with it on `prepare` / `check` are skipped (their `if`), the work
  jobs run the same guard steps (deep-equal to the guard job's) before the checkout, followed by an emptied
  workspace; checkout refs, cache key, build's image and commit fall back to the step outputs; workflow outputs read
  the work jobs; deploy-app refuses `guard-in-job` with `deploy: true` (script run).
- `.github/workflows/deploy-release-checks.yml`, `.github/workflows/deploy-app.yml`.
- Done when: `npx vitest run tests/repo/deploy-workflows.test.ts tests/repo/workflow-runners.test.ts` passes and
  actionlint (CI) is green.

### Phase 2: caller, docs, release

- `tools/deploy/examples/deploy-pipeline.yml`: `guard-in-job: true` on the `static` and `build` calls; its tests.
- README (release checks, fail-fast pipeline), CHANGELOG, patch version, `deploy-cli-version` defaults.
- Done when: typecheck, lint and the repository tests pass.

## Progress

- [ ] Phase 1: workflows and tests
- [ ] Phase 2: caller, docs, release
