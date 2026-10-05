# Plan review: blog-check-without-database

Reviewed: plan.md @ 2026-10-05. Mode: quick (small, one phase). Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: 9/9 paths (`foundation/core/src/config.ts`, `foundation/core/src/cli/load-config.ts`,
`foundation/core/src/cli/index.ts`, `foundation/core/src/index.ts`, `foundation/core/tests/cli.test.ts`,
`foundation/core/tests/config.test.ts`, `modules/blog/src/cli/command.ts`, `modules/blog/tests/cli.test.ts`,
`.github/workflows/blog-links.yml`), 5/5 symbols (`defineSoftureConfig`, `checkDatabase`, `loadConfig`,
`loadAppConfig`, `parseBlogCommand`), 4/4 commands (`workflow.json` gates and `npm run build`).

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (check, publish, workflow each have a check) |
| Slicing | PASS |
| Verifiability | WARN (W1) |
| Data and migrations | PASS (no data) |
| Tests | PASS |
| Security | PASS (no value invented; a real URL is never dropped; the flag is scoped to one import) |
| Lean | PASS (one helper, one option) |
| Fit | PASS (union option, result types unchanged) |
| Cost and defaults | PASS (default `"required"` keeps every other caller) |
| Scope | PASS (S1 goes to the roadmap) |
| Reuse | PASS (BF-1's loader) |
| Lessons | PASS |
| Progress format | PASS |

## Findings

### W1 [WARNING] The fixture's variable must be one nobody sets

The blog fixture reads its URL from an environment variable. `DATABASE_URL` is set in the e2e job and
on developer machines, which would make the test pass for the wrong reason.

**Fix:** the fixture reads `SOFTURE_FIXTURE_UNSET_DATABASE_URL` and the test asserts it is unset.
Applied to the plan's step for the fixture (implementation follows it).

### S1 [SUGGESTION] `skill install --check` never connects either

`runSkillInstall` renders templates from the config and touches no database; a CI step that runs
`softure-blog skill install --check` meets the same requirement. Outside BF-6's outcome.

**Fix:** a gap item on the roadmap (BF-13), not in this change.
