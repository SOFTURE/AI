# Plan review: deploy-fire-parity

Reviewed 2026-10-06 against change.md, research.md, the package on `master` `225882e` and the parallel items DF-5
and DF-7. Verdict: **approve with the fixes below applied to plan.md.**

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| P1 | Warning | Phase 1 changes the default output of `env render` (a header comment line), and `tests/cli.test.ts` asserts the stdout line exactly; `init`'s `deploy.sh` reads values with `grep -m 1 "^NAME="`, which a comment line never matches. The default change is safe, but the plan must say the CLI test is updated on purpose, not "unchanged". | Accepted: Phase 1 lists `tests/cli.test.ts` and the stdout line `wrote N names (M optional)`; the file test asserts the header. |
| P2 | Warning | `env render` refuses a compose file with no required name. With optional names in, a file with only `${X:-…}` names would still be refused. | Accepted: "nothing to render" only when there are neither required nor optional names. |
| P3 | Warning | Phase 3 imports `parseTableList` from `src/db/row-counts.ts`, which DF-5 owns and may change. | Accepted: import only, no edit; the thread merges `master` before the PR and re-runs the backup tests, so a rename on DF-5's side shows as a type error, not a silent drift. |
| P4 | Suggestion | Phase 4: `verify` runs routes four at a time, so a `POST` route runs alongside others; a non-idempotent route (a counter) is counted on each run. FIRE does the same (`/kalkulator/licznik` with a control key). | Accepted as README guidance: a `POST` route should be one the app treats as a no-op or a control request. |
| P5 | Suggestion | Phase 4: Node's `fetch` refuses or overrides some request headers (`host`, `content-length`, `connection`); a config with them would fail at run time, not at parse time. | Accepted: the schema refuses `host`, `content-length`, `connection` and `transfer-encoding` by name. |
| P6 | Suggestion | Phase 2: a release body that holds the marker pair twice (a hand edit) would be rewritten only at the first pair. | Accepted: replace from the first opening to the first closing marker after it; documented; a test covers a body with text after the section. |
| P7 | Suggestion | Gap numbers: DF-8 is not on `master` yet, but the coordinator plans it for DF-5's follow-up (`deploy.sh` reads `rowCountTables`). Taking DF-8 would collide. | Accepted: DF-9…DF-13; renumber at merge if `master` moved. |

No finding blocks implementation. Out-of-scope boundaries (DF-5's `row-counts.ts`, DF-7's two files) hold in every
phase.
