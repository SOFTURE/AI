---
change_id: deploy-smoke-fields-922
---

# Research: app fields in the smoke check, its result, changelog columns (issue #922)

Read on master 3bb947e. No other session has started this: no open pull request, branch, change folder or commit
mentions #922, and `expect-file`, `smoke-result`, `build-info-expect` appear nowhere.

## What exists

- `modules/ops/src/server/build-info.ts`: `createBuildInfoResponse(options)` answers `{ release, commit, builtAt,
  startedAt }` plus `changelog` when a provider is passed; no way to add the app's own fields.
- `tools/deploy/src/smoke/smoke-checks.ts`: `buildInfoSchema` (zod object, unknown keys stripped), `runSmokeChecks`
  (release, commit, started), `formatSmokeReport` (Result / Check / Detail table). `fetch-build-info.ts` returns only
  the parsed schema, so other fields are lost before the checks.
- `tools/deploy/src/cli/smoke-command.ts`: flags `--tag --commit --deployed-at --path --headers-file --timeout
  --tolerance-seconds`; the failure line names the failed check kinds.
- `.github/actions/deploy/action.yml`: step `smoke` (after the routes, from a sparse checkout of the tag) runs the CLI,
  writes `Smoke check: passed/failed` to the summary, exits with the CLI's status. Outputs: `server-lines`, `sent-at`.
- `.github/workflows/deploy-app.yml`: input `build-info-path` validated in `check`, passed to the verify job's action
  call and to the e2e verify call in the deploy job. Outputs: `release`, `sha`, `image`, `digest`.
- `tools/deploy/src/notes/roadmap-items.ts`: `parseRoadmapItems` reads the At a glance table by position (id, change,
  outcome, last cell = status); the header row is skipped. `changelog.ts` keeps `{ id, changeId, status }`.
- Tests: `tools/deploy/src/smoke/smoke-checks.test.ts`, `tools/deploy/tests/smoke-cli.test.ts`,
  `tools/deploy/src/notes/changelog.test.ts`, `modules/ops` build info tests, `tests/repo/deploy-workflows.test.ts`
  (the action and workflow wiring, a bash run of the smoke step with a stub `npx`).

## Findings

- A composite action output can read a step output; a step that writes `result=failed` first and `result=passed`
  last leaves the right value whether it exits 0 or not (the last line for a key wins).
- An expected value that depends on the tag (a tool list version measured at build) comes from an earlier job of the
  caller: `with: build-info-expect: ${{ needs.measure.outputs.expect }}` works for a reusable workflow input.
- zod 4 is in use; reading the raw JSON object next to the parsed schema avoids changing the schema's strictness.
