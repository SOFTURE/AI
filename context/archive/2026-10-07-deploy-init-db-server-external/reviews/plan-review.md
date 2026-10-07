# Plan review: deploy-init-db-server-external

Reviewed: `plan.md` against `change.md`, issue #184 and the current sources of `tools/deploy/src/init/app-facts.ts`,
`tools/deploy/src/cli/init-command.ts`, `tools/deploy/tests/init-cli.test.ts` and `foundation/db/README.md`.
Verdict: **approved with fixes applied**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | D1 as first written matched `@softure-ai/db` anywhere in the array text, so a comment such as `// not @softure-ai/db` inside the list would count. | Fixed in the plan: the entry must be a quoted string literal (`"`, `'` or a backtick) inside the array. |
| F2 | Suggestion | Next 14 called the key `experimental.serverComponentsExternalPackages`; an app on it would get the warning. | Accepted as is: the deploy templates and the monorepo target Next 15+ (`serverExternalPackages`); on Next 14 the warning is still true advice (the new key is what the db README documents). |
| F3 | Suggestion | `write-e2e-app.ts` reads the example app's facts; the example's `next.config.ts` lists only the drivers. | No impact: the script plans files and prints no warnings; `isDbServerExternal` does not change any generated file. The example app belongs to #179 / PR #185. |
| F4 | Suggestion | D3 points to "§2 Installation" while the section #185 adds may get its own subheading. | Kept: the warning names the key (`serverExternalPackages`) and the section number the issue gives, so it stays findable whatever the subheading. Recorded under Decisions (auto). |

No migration, no cross-package contract, no generated file changes. The version bump stays with this change (no
other open change touches `tools/deploy`).
