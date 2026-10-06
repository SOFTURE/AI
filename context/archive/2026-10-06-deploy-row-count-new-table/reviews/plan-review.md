# Plan review: deploy-row-count-new-table

Reviewed: `plan.md` against `change.md`, the roadmap item DF-14, `tools/deploy/src/db/row-counts.ts`,
`src/cli/db-commands.ts`, `templates/docker/server/deploy.sh.tmpl`, `e2e/app/` and the lessons in
`context/foundation/`. Verdict: **approve** after the fixes below (applied).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The note on old counts files mixed two claims (a file format and a version switch mid-deploy) in one sentence that read as a contradiction. | Fixed: one sentence each; both server steps run the pinned CLI version. |
| 2 | Warning | `e2e/app/docker/server/deploy.sh` carries the same comment line as the template (line 397), and `tests/e2e-scripts.test.ts` fails when the committed copy and `init` disagree; the plan said "if the comment reaches it". | Fixed: the regenerated file is listed, and step 3 checks that the diff is that one line. |
| 3 | Warning | A table absent after the deploy fails with `deploy.sh`'s message "rows were lost on $TAG", which is not literally true for a misspelled name. | Kept: the roadmap keeps `deploy.sh` as DF-8 left it (lane B note) and other threads change that file now; the CLI line right above names the table and the reason. Recorded under "Accepted risk". |
| 4 | Suggestion | `to_regclass` on a schema that does not exist: it must return `NULL`, not raise. | Covered: the PGlite test counts `billing.absent` with no `billing` schema. |
| 5 | Suggestion | `RowCountChange` is exported from `@softure-ai/deploy`; turning it into a union changes a public type. | Accepted: nothing in the repository imports it outside the module, 0.1.3 is unpublished and the package is pre-1.0. |

Checked and fine: scope matches the outcome (absent before passes, counted before and missing after fails); the test
list covers the empty, boundary and failure cases; PGlite is already in the tree through `@softure-ai/db`, so the
devDependency adds no new package; no migration, secret or workflow change.
