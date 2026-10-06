# Implementation review: deploy-release-report

Reviewed: commits `da4a990`, `8c28e2f` and `333eb11` (with the merge of DF-9, `0fa6aba`) against plan.md, the plan
review's accepted fixes and FIRE_TRACKER's `release-notes.ts` and `release.yml` report job. Verdict: **approve** after
the two fixes below; no open findings.

## Against the plan

- `softure-deploy release-report --body --summary [--locale] [--out]`: the summary is parsed with a strict zod schema
  (`version: 1`); a wrong shape fails with the field's name, a missing body file is an empty body.
- `release-body.ts` has one section mechanism for three keys (`release-notes`, `status`, `deployments`) in a fixed
  order; `release-notes`' markers and behaviour are unchanged (its tests untouched and green).
- Status replaced per run; a deployment row prepended, earlier rows kept byte for byte; `failed at <step>` from the
  server's result line; `3 → ?` when the counts after are missing (P3); no row when the deploy job was skipped.
- `deploy.sh`: `step|backup|ok|<file>` (deploy and maintain), `step|row-counts-before|ok|t=n,…` and
  `step|row-counts-after|ok|t=n,…` (the compare call writes `--out` too). The e2e copy regenerated.
- `deploy-app.yml`: the deploy job's `server-lines` output (`if: always()`, P2), the cleanup removes the output file;
  the `summary` job (`always()`, `permissions: {}`) writes `deploy-report.json` with `jq` and uploads it with
  `overwrite: true`.
- `deploy-report.yml`: one job, `contents: write`, `continue-on-error: ${{ !inputs.e2e }}`, a concurrency group per tag
  (`-e2e-<run id>` on the test path, P1), the token only on the two `gh` steps with `--repo` (P4); no release: a
  notice. The example caller has a `report` job with `contents: write` on that job only; the e2e caller runs it with
  `e2e: true` and `check-report.sh` checks the body.
- Repository test: no job but `build` has `packages: write`, no job but deploy-report's `report` has
  `contents: write` (P5); the summary script is run and its JSON checked.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| I1 | Warning | `gh release view` failing for any reason (token, network) was read as "no release", so a broken report would be silent. | Fixed: only `release not found` is a notice; any other error prints gh's message and fails the step. |
| I2 | Warning | A digest shorter than 19 characters got a `…`, and the `…` itself was turned into `?` by the cell filter. | Fixed: the value is filtered first, the ellipsis added only when it was cut; test added. |
| I3 | Suggestion | `back_up_database` reads the file name from the CLI's `backup: wrote <path> (<n> bytes)` line, a coupling to the CLI's output text. | No change: both live in this package and `server-files.test.ts` pins the line; an unmatched line only leaves the detail empty. |
| I4 | Suggestion | The first DF-9 merge commit was made with `LEFTHOOK=0` (a merge of reviewed master only). | No change: `pre-push` runs the full gates on the pushed head. |

## Checks

- `npm run typecheck`, `npm run lint` (with the language gate), `npm run build`: green.
- `vitest run tools/deploy tests/repo`: 584 passed; the full `npm test` runs in `pre-push`.
- actionlint 1.7.12 with shellcheck 0.11 over `.github/workflows/` and `tools/deploy/examples/deploy.yml`: clean.
- The summary job's script run locally and its JSON fed to the built CLI: the body above the report kept, status and
  a `failed at switch` row written.
- The `e2e-deploy` run on the pull request: see Progress.

## Gaps

None new. DF-15 (the shipped `deploy.sh` in the e2e) would also let the e2e report show a backup and row counts.
