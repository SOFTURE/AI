# Plan review: deploy-init-named-secrets

Reviewed 2026-10-14 against `change.md`, `research.md`, the init generator, the template, the example and their tests on `dedec0b`.

| # | Finding | Severity | Decision |
|---|---|---|---|
| F1 | `deploy-report.yml` with `needs: deploy` must still find the `deploy-report` artifact; it now comes from the action, not deploy-app.yml's `summary` job. | Suggestion | Research §3: the action uploads it with `report: true`; the example's report job needs `[build, deploy]` and runs when `build` succeeded, as the environments example does. |
| F2 | `app-vars` on `build` would be refused or unused with `deploy: false`. | Warning | Move it to the action step only (research §4). |
| F3 | An app with no required secret must not get an empty `env:` or `secret-names`. | Warning | Section `hasSecretNames` around both; test the no-database, no-`--env` plan. |
| F4 | PR #480 edits the template header and `buildValues`. | Suggestion | Edits stay below the header; merge master before the PR and before the merge. |
| F5 | `concurrency` group without the repository name is per repository already (groups are scoped to the repository). | Suggestion | Keep `deploy-production`, as the environments example. |

Verdict: ready to implement.
