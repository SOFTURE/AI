# Implementation review: cli-config-loader

Scope: full · Date: 2026-10-05 · Commits: 9702869 · Gates: typecheck ✓ lint ✓ test ✓ (13 core cli tests; db, mailing and blog cli tests and db's bundle test unchanged and green) · build ✓

## Verdict

Ready. The one phase delivers what the plan asked: `@softure-ai/core/cli` holds `DEFAULT_CONFIG_FILES`,
`takeConfigOption`, `findDefaultConfig`, `loadConfig` and `loadAppConfig`, and the three bins call it.
No finding blocks the merge; one observation goes to the record below.

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | — |
| Correctness | PASS | F1 (observation) |
| Tests | PASS | mutation checks below |
| Security | PASS | — |
| Patterns | PASS | — |
| Progress honesty | PASS | — |

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1. Shared loader in core, used by the three bins | 9702869 | yes | loader, `./cli` export, three bins rewired, core and db READMEs |

Files: planned and changed 11 · unplanned 0 · planned, not changed 0.
`grep -n "function takeConfigOption\|function findDefaultConfig\|function loadConfig"` over the three
`command.ts` files finds nothing. Their test files are untouched (`git diff master -- '*/tests/cli.test.ts'` is
empty apart from the new core test).

## Findings

### F1 [OBSERVATION] `softure migrate` now also requires a `database` key
**Where:** `foundation/core/src/cli/load-config.ts` (`isConfigLike`)
db's own copy accepted an object with `modules` and no `database` key; the shared check needs both, as
mailing's and blog's did. Planned (plan Key decisions, research Risks): `defineSoftureConfig` always sets
`database`, so only a hand-written object is affected, and it now gets the "must export … the result of
defineSoftureConfig" message instead of "the config has no database". **Decision:** accepted (auto).

## Mutation checks

- Dropping the `database` key check: `loadConfig` "refuses an export that is not a config" fails.
- Accepting a `--config` value that starts with `--`: `takeConfigOption` "refuses --config without a path" fails.

## Gaps for the roadmap

None found.
