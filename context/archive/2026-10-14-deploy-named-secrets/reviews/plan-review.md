# Plan review: deploy-named-secrets

Reviewed 2026-10-14 against `change.md`, `research.md`, `deploy-app.yml`, the deploy action and their tests on `cfb9aad`.

| # | Finding | Severity | Decision |
|---|---|---|---|
| F1 | The caller's step `env:` also reaches the action's other steps (ssh, verify); a name like `SSH_HOST` there would shadow nothing, because each step sets its own `env:`, which wins. | Suggestion | Recorded; the render step refuses names it sets itself, which is where a clash would change a value. |
| F2 | Removing the flag outright makes GitHub fail the call with "invalid input" and no hint. | Warning | Keep the input, refuse `true` in the check job with the migration hint (plan Phase 2.1). |
| F3 | Parallel PRs #480 and #482 edit the deploy README and CHANGELOG. | Warning | Merge master before the PR and before the merge; keep CHANGELOG edits to a new section. |
| F4 | `verify-env-secret` is also an action input (message label); removing it from the action would break callers. | Suggestion | Only the workflow input goes; the action keeps it. |

Verdict: ready to implement.
