# Plan review: adoption-gaps-ops-switches-deploy-core

Reviewed: `plan.md` against `change.md`, issue #158 and the current sources named in § Findings, plus the db
migrator's ordering rules, the release pack step and deploy's `init` templates. Verdict: **approved with fixes
applied**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Critical | Phase 1 changes `01-roles.sql`, but `tools/deploy/src/init/generate.test.ts` pins deploy's template `templates/docker/prod/initdb/01-roles.sql.tmpl` to the ops recipe byte for byte, and the committed e2e app carries a generated copy. Phase 1 would go red in deploy. | Fixed in the plan: Phase 1 updates deploy's copy and regenerates the e2e app. |
| F2 | Warning | D2's event trigger: who runs the function, and can it revoke? The trigger function runs as the DDL's role; the migrator owns the new table and is the grantor of the default privileges, so its REVOKE removes them. A table created by another role (an app's own ledger migrated by its owner) has no grant to the app role from the migrator's defaults; the REVOKE then only warns. | Recorded in D2; the recipe run in the impl review checks both cases. |
| F3 | Warning | D11 adds optional `dependsOn` entries to auth and billing. `orderModules` then places ops and mailing before auth when listed, which changes the migration order of an app that lists them after auth. The migrator checks order per module only (`db.migration_out_of_order` carries module and version), so an existing ledger stays valid. | Accepted; the full test suite (example app config included) proves it. Noted in the impl review. |
| F4 | Warning | D7 relies on `postgresql<major>-client` existing in `node:22-alpine`'s Alpine release for the compose file's Postgres major. Majors 14–17 are packaged there; an unpackaged major fails the build of the helper image with apk's message, before anything restarts (backup is a pre-switch step). | Accepted: hosts with Node keep today's path; README states the requirement. |
| F5 | Suggestion | D3: a secret read from stdin must not be echoed in a usage error. | Usage errors name the argument, never its value; the test asserts the value is absent from the output. |
| F6 | Suggestion | D12: npm does not always include `CHANGELOG.md` by itself; the release pack test checks exports and LICENSE only. | `files` lists it explicitly (already in D12); the package test checks the entry. |
| F7 | Suggestion | D9: an `instanceof` check alone fails when an app ends up with two copies of core (a module's nested dependency). | The brand symbol from D9 covers it; the test builds a foreign object with the brand. |

No migration and no cross-package contract change beyond optional options and new exports. db code stays untouched
(issue #179 runs in parallel).
