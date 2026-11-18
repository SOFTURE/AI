# Research: deploy-guard-in-job (#1375)

## Current state

- `deploy-release-checks.yml` (332 lines): `prepare` runs when `tag != ''` or `unit && shards != 1`. It checks the
  inputs (anchor `check-inputs`, also run by `static` and `unit`), checks out the tag's history as commits only
  (`tree:0`, sparse `/package.json`) and resolves the commit (`Resolve the commit`: tag names a commit, release branch
  exists, commit is its ancestor). Outputs `sha`, `revision`, `shards`. `static` and `unit` need `prepare`, run when it
  did not fail, and check out `needs.prepare.outputs.revision`. The static cache key uses `needs.prepare.outputs.sha`.
  The workflow output `sha` is `jobs.prepare.outputs.sha || github.sha`.
- `deploy-app.yml` (876 lines): `check` (name `check inputs`) validates every input (`Validate inputs`, id `inputs`,
  outputs image, server-files, release), checks out the tag's history (`tree:0`, sparse compose file) and refuses a
  tag off the release branch (id `commit`, output sha). `build` needs `check`, runs on `inputs.build`, reads
  `needs.check.outputs.image` and `.sha`. `deploy`, `verify`, `summary` read the check job's outputs and result.
- The adopting app's pipeline (`examples/deploy-pipeline.yml`): `release` (deploy-app, `build: false`, check only,
  needed for the preflight), `static` (release checks with a tag, `unit: false`, so `prepare` + `static`), `unit`
  (four shards, `prepare` needed for the shard list), `build` (deploy-app with `deploy: false` and `prebuilt-image`:
  `check` + `build`). The issue's two billed guards are the `static` call's `prepare` and the `build` call's `check`.

## Constraints found

- GitHub Actions takes YAML anchors and aliases but no merge keys, so an aliased step cannot get another `if:`; a step
  shared by the guard job and the work job carries a condition that holds in both (`github.job == '<guard job>' ||
  inputs.guard-in-job`).
- actionlint rejects `needs.<job>` in a job that does not need it, so the shared condition reads inputs and
  `github.job`, not `needs.prepare.result`.
- The guard's checkout leaves a partial (`tree:0`), sparse clone in the workspace; the work job's own checkout then
  would reuse it. Emptying the workspace again after the guard gives the work checkout the clean start it has today.
- Matrix job outputs: every shard writes the same `sha`, so `jobs.unit.outputs.sha` is well defined.
- `deploy: true` with the fold would need deploy, verify and summary to read `build`'s outputs and accept a skipped
  `check`: more surface for no gain in the pipeline the issue measures. Refused instead.

## Options

1. Fold the guards (chosen): saves both minutes, outputs unchanged for the caller.
2. Let `deploy-app.yml` skip only the repeated branch check: the check job still runs, so no billed minute is saved.
