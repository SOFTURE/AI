# Plan review: blog-skill-check-without-database

Reviewed: plan.md @ 2026-10-05. Mode: quick (small, one phase). Verdict: ready.
Findings: 0 critical, 0 warnings, 1 suggestion.
Grounding: 3/3 paths (`modules/blog/src/cli/command.ts`, `modules/blog/tests/cli.test.ts`,
`modules/blog/README.md`), 4/4 symbols (`runBlogCommand`, `loadAppConfig`, `parseBlogCommand`,
`runSkillInstall`), fixture `modules/blog/tests/fixtures/without-database.config.mjs` present, 4/4 commands
(`workflow.json` gates and `npm run build`).

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (install, `--check`, publish refusal and README each have a check) |
| Slicing | PASS |
| Verifiability | PASS (the test fails first with the load error) |
| Data and migrations | PASS (no data) |
| Tests | PASS (reuses BF-6's fixture with the unset-variable assertion) |
| Security | PASS (no value invented; `publish` keeps the requirement) |
| Lean | PASS (one set, no new option) |
| Fit | PASS (BF-6's `DatabaseRequirement` union) |
| Cost and defaults | PASS (a new command is required unless listed) |
| Scope | PASS |
| Reuse | PASS (BF-6's loader option and fixture) |
| Lessons | PASS |
| Progress format | PASS |

## Grounding notes

- `runSkillInstall` (`modules/blog/src/cli/run.ts`) calls `renderBlogSkill(options.config, …)`, which reads
  the blog module's options; nothing in the skill path reads `config.database` or opens a connection.
- No workflow in `.github/workflows/` runs `skill install --check`; the "placeholder `DATABASE_URL`" of the
  item's risk is an app's own CI job, which the README tells to run the check. The README change is the
  place that reaches it.

## Findings

### S1 [SUGGESTION] Assert the installed folder too

The `--check` after the install proves the files match the config, which covers what install wrote.

**Fix:** none needed; the `--check` line is the assertion.
