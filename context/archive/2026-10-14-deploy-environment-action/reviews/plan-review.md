# Plan review: deploy-environment-action

Reviewed 2026-10-14 against `change.md`, `research.md`, `deploy-app.yml` and its tests on `f5830d0`.

| # | Finding | Severity | Decision |
|---|---|---|---|
| F1 | A composite action cannot use `secrets`; the workflow's `secrets[...]` lookups must stay in the workflow and be passed as inputs. | Warning | Planned: the deploy job resolves the values and passes them; the SSH presence check stays a workflow step. |
| F2 | `actions/checkout` at the workspace root would delete the self-checkout. | Warning | Action checks out into `.softure-ai-release/` (research §5). |
| F3 | The e2e verify steps run the CLI from the tag with the run's CA. | Suggestion | Action inputs `deploy-cli` and `ca-file`; e2e uses the action's verify phase too. |
| F4 | A caller-side job that fails at build leaves no `deploy-report`. | Suggestion | Documented; the example caller's report job runs when the deploy job ran. |
| F5 | `job.workflow_sha` is unavailable on GitHub Enterprise Server. | Suggestion | Documented; the package targets github.com. |

Verdict: ready to implement.
