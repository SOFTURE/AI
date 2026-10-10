# Plan review: deploy-integration-artifacts-cache

Reviewed plan.md against change.md, issue #368 and `deploy-integration.yml` on master. Mode: autonomous.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | `if: failure()` alone (the issue's wording) never uploads on a red suite: the suite step exits 0 and only the later "Fail on a red suite" step fails. | Accepted in the plan: the condition also checks `steps.suite.outputs.result == 'red'`, and the step runs before the failing one. Tested. |
| F2 | Warning | A `cache: npm` default breaks a caller whose repository has no `package-lock.json` (setup-node errors). | Accepted as the issue's proposal: the default `setup-command` needs the lockfile too; the CHANGELOG and README name `node-cache: ""` for such a caller. |
| F3 | Suggestion | `artifact-paths` reaches only `upload-artifact`, not a shell, yet a path outside the workspace would upload runner files. | Accepted: validated like the report paths. |

No finding blocks the plan.
