---
change_id: deploy-smoke-fields-922
verdict: approved
---

# Implementation review

Reviewed the branch diff against plan.md and master (3bb947e).

- Plan coverage: all four phases are in. ops: `BuildInfoOptions.fields` answered at the top level, build facts and
  `changelog` winning, a failing or non-object provider adding nothing with a log line. deploy: `fetchBuildInfo`
  returns the whole answer, `runSmokeChecks` adds one `field` check per expected field (strict equality, JSON in the
  detail), `getSmokeCheckName` names the row and the failure line, `smoke --expect-file` validates names, values, the
  count and the fields its own flags check; `readRoadmapTable` reads the header, `changelog --fields` copies named
  columns. Action: `build-info-expect` (file for the CLI, object check, refused without `build-info-path` in the
  release step), the step's `result` output (`failed` first, `passed` on success), output `smoke-result`.
  `deploy-app.yml`: input validated in `check`, passed to both verify calls, job outputs on verify and deploy (e2e),
  workflow output `smoke-result`.
- Opt-in holds: without `fields`, `--expect-file`, `--fields` or `build-info-expect` the route answer, the smoke table
  and the changelog JSON are unchanged (existing tests pass untouched apart from the new env and output keys).
- Shell: bash 3.2 constructs only; `jq -e` as in the other steps; the expect file is removed by the step's trap.
- Public data: fields and changelog columns are the app's explicit choice, documented as public.
- Tests: route fields (merge order, failure, non-object), checks and report rows, CLI pass/fail and every refusal,
  changelog columns (case, markup, escaped pipe, missing column), the action step with a stub `npx` (expect file,
  result output, refusals), the release step refusal, the check job's validation and the outputs wiring.

Verdict: approved.
