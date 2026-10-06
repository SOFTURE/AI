# Plan review: deploy-row-count-server-list

Reviewed: plan.md against change.md, research.md, the DF-5 and DF-7 archives and the code
(`tools/deploy/src/cli/db-commands.ts`, `src/init/generate.ts`, `templates/`, `tests/server-files.test.ts`).
Verdict: **ready to implement** after the two accepted fixes below.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | `init` keeps an existing `deploy.json` (no `--force`), so `--tables` on an app that already has one writes nothing and says only "kept deploy.json". Before, the list went into `deploy.sh`, which is kept the same way, so behaviour is unchanged, but the place to edit by hand moved. | Accepted: the README's `init` section says that with an existing `deploy.json` the list goes into `database.rowCountTables` by hand. |
| 2 | Warning | The plan's test list has no case for a release whose `deploy.json` names tables but which is the first release (no previous tag). The skip on the first release is the same condition as today, but it now sits next to a new check and is easy to reorder. | Accepted: test step 1 asserts the first release calls no `row-counts` even with tables listed (already worded so; made explicit in the test). |
| 3 | Suggestion | `--tables` on an app without a database is accepted and dropped (the plan writes the key only with a database). This was already so for `deploy.sh`. | Kept as is: no behaviour change, and a warning belongs to `init`'s answers, not to this item. |
| 4 | Suggestion | `node -e` gets the file as `process.argv[1]` (with `-e` there is no script path); worth a test rather than trust. | Covered by test step 1 (the check runs for real against files on disk). |

Contracts checked: `row-counts --config` takes a path relative to the cwd or absolute (`resolve(io.cwd, …)`), and the
script passes an absolute one; `--compare` with `--config` reads both (`readRowCountTables` refuses only `--tables`
with `--config`). The release folder of the running tag is never pruned in its own run (`ls -1t`, newest kept). No
migration, no workflow change, no new dependency. Lessons: a bug-fix-first rule does not apply (no bug); the tests are
written red first per the plan's discipline.
