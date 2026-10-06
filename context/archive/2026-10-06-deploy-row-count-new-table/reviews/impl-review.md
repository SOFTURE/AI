# Implementation review: deploy-row-count-new-table

Reviewed: the branch diff against `master` (`tools/deploy/src/db/row-counts.ts` and its test,
`src/cli/db-commands.ts`, `src/cli/run.ts`, `package.json`, `README.md`, the `deploy.sh.tmpl` comment and its
`e2e/app/` copy) against `plan.md`. Verdict: **approve**; no open finding.

## Against the plan

| Plan item | Where | State |
| --- | --- | --- |
| Counts file takes `null` for an absent table, old files still parse | `rowCountsFileSchema` (`.nullable()`), test "accepts the file --out writes, absent tables included" | done |
| `countRows` checks `to_regclass` first, takes a `Queryable` | `countRows`; PGlite tests for `public`, a schema, a missing table, a missing schema and an empty table | done |
| Discriminated `RowCountChange` (`counted`, `new`, `absent`, `uncounted`), `lost` the failing ones | `compareTable`, `isRowCountLoss`; four `compareRowCounts` tests with exact objects | done |
| Output lines and grouped failure reasons | `formatRowCountChange`, `formatRowCountLoss` (in the module so they are unit-tested without a server); `runRowCounts` prints them | done |
| `deploy.sh.tmpl` comment only, commands and messages as DF-8 left them | the comment above the `row-counts-before` call, `e2e/app/docker/server/deploy.sh` regenerated (the diff is that comment) | done |
| README and usage text | `row-counts` section, server step 3, `USAGE` | done |

Tests were red before the implementation (6 of 9 failing: `countRows` without the absent case, the union shape, the
nullable schema) and green after.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Suggestion | The CLI's `runRowCounts` has no test of its own (it needs a Postgres URL); a wrong line would pass. | Fixed: the line and the failure text moved into `formatRowCountChange` / `formatRowCountLoss` in `row-counts.ts` and are asserted string for string; `runRowCounts` only joins them. |
| 2 | Suggestion | `before[table]` on a plain object would read inherited keys for a name like `constructor`. | Fixed: `Object.hasOwn` decides "not counted before". Table names are validated lower snake case, so it was also unreachable. |
| 4 | Warning | CI caught what the local run skipped: `tests/db-cli.test.ts` runs only with `SOFTURE_TEST_POSTGRES_URL`, and two of its cases asserted the old failure line and the old "relation does not exist" error. | Fixed: the failure line updated; the old case replaced by two on a real Postgres (absent before and created by the release passes, counted before and dropped fails); the file passes against a local Postgres 16. |
| 3 | Suggestion | A misspelled table now fails after the switch instead of before it. | Accepted in the plan ("Accepted risk"); the README names `absent -> absent` as the sign of a misspelled name. |

Checked and fine: `pg.Client` satisfies `Queryable` (typecheck); `to_regclass` takes the quoted name as a parameter,
so nothing user-given is spliced into SQL beyond the validated, quoted identifier the `count(*)` already used; no
new dependency in the published package (`@electric-sql/pglite` is a devDependency, already in the tree through
`@softure-ai/db`); no migration, secret or workflow change; the language gate passes.
