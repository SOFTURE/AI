---
change_id: deploy-smoke-fields-922
status: in_progress
---

# Plan: app fields in the smoke check, its result, changelog columns (issue #922)

Input: change.md, research.md. Complexity: medium (two packages, the deploy action, one workflow, docs).

## Phase 1: ops answers the app's own fields (TDD)

Files: `modules/ops/src/server/build-info.ts`, its test, README.

1. `BuildInfoOptions.fields?: () => Record<string, unknown> | Promise<...>`: the app's own public fields, answered at
   the top level of the build info. The build facts (`release`, `commit`, `builtAt`, `startedAt`) and `changelog` win
   over a field of the same name. A provider that throws or returns something other than a plain object adds nothing
   and logs the error class, so the smoke check fails on the missing field instead of the route failing.

## Phase 2: deploy CLI (TDD)

Files: `tools/deploy/src/smoke/*`, `src/cli/smoke-command.ts`, `src/notes/roadmap-items.ts`, `src/notes/changelog.ts`,
`src/cli/changelog-command.ts`, tests.

1. `fetchBuildInfo` also returns the raw JSON object (`fields`).
2. `runSmokeChecks` takes `expectation.fields` (name → JSON text, number, boolean or null): one `field` check per name,
   strict equality, after release, commit and started; the report row is named after the field.
3. `softure-deploy smoke --expect-file=<json>`: a JSON object of at most 50 fields, names `^[A-Za-z_][A-Za-z0-9_-]{0,63}$`,
   values text, number, boolean or null; `release`, `commit`, `startedAt` refused (their own flags check them).
4. `parseRoadmapItems` keeps each row's cells by header name (`columns`); `softure-deploy changelog --fields=<names>`
   (comma-separated, at most 10, header names matched case-insensitively) adds `fields` to every item with the named
   columns' text (markup stripped); a roadmap without the column leaves the name out.

## Phase 3: the action and deploy-app.yml

1. Action: input `build-info-expect` (a JSON object, written to a file for `--expect-file`; refused when it is not an
   object, and in the release step when set without `build-info-path` while verify runs); the smoke step writes
   `result=failed` first and `result=passed` on success; output `smoke-result` = `steps.smoke.outputs.result ||
   'skipped'`.
2. `deploy-app.yml`: input `build-info-expect` validated in `check` (a JSON object of text, number, boolean or null
   values; needs `build-info-path`), passed to both verify calls; job outputs `smoke-result` (verify job, deploy job for
   e2e); workflow output `smoke-result` (`passed`, `failed`, `skipped`).
3. Repository tests for the wiring and a bash run of the smoke step with the expect file and the result output.

## Phase 4: docs

deploy README (smoke `--expect-file`, `build-info-expect`, `smoke-result`, changelog `--fields`), ops README
(`fields`), the deploy-app.yml header, both CHANGELOGs under `## Unreleased`.

## Decisions (auto)

- Expected values come as a JSON object (file for the CLI, JSON text for the action and workflow), not repeated
  `--expect=name=value` flags: it keeps types (a count is a number) and one input carries any number of fields.
- Top-level fields only; nested paths are not needed for the reported case.
- `smoke-result` is `skipped` when the smoke step did not run (no `build-info-path`, verify off, or an earlier step
  failed).
- The changelog keeps its public-by-default shape: extra columns only when named.
- No version bump: the coordinator releases (the `deploy-cli-version` default follows in the release).

## Progress

- [ ] Phase 1: ops fields
- [ ] Phase 2: deploy CLI
- [ ] Phase 3: action and workflow
- [ ] Phase 4: docs
- [ ] Implementation review
