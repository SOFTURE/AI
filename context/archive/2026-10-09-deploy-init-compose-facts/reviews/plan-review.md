# Plan review: deploy-init-compose-facts

Reviewed: `plan.md` against `change.md`, issue #297 and the current sources of `tools/deploy/src/init/`,
`tools/deploy/src/cli/init-command.ts`, the templates and `tests/repo/deploy-workflows.test.ts`.
Verdict: **approved with fixes applied**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Critical | D3 as first written took the role from the app's compose file even under `--force`, which replaces that file with init's own (`DATABASE_URL` as `softure_app`): `report` would then read as a role the new stack never creates. | Fixed in the plan: `planInitFiles` takes `replacesCompose`; with it the role is `softure_app` and no compose warning prints. The Postgres major still comes from the old file, so a forced compose file keeps the data volume's major. CLI test added. |
| F2 | Warning | The issue names only `README` for the tag, but the templates `init` writes and three examples carry the same missing tag, so a freshly generated caller fails at `uses:`. | Kept in scope (D5): the issue is about "what `init` writes or what the README promises". |
| F3 | Warning | A `deploy@0.1.6`-style tag as the `uses:` ref would pin without a SHA, but whether `uses:` accepts a second `@` is not documented. | Not relied on (D5): the README and the warning name the SHA from `git ls-remote`. |
| F4 | Suggestion | The `--workflows-ref` warning on every run without the flag is noise for an app that keeps both callers. | Fixed in the plan: printed only when `init` wrote at least one caller. |
| F5 | Suggestion | An existing compose file of an app without a database would still be read and could warn. | Fixed in the plan: compose warnings only with the database part on (the values only matter there). |

No migration, no cross-package contract. `e2e/app/` does not change: the example app has no `docker/prod/`. #296
edits the same package; the CHANGELOG entry goes under `## Unreleased`.
