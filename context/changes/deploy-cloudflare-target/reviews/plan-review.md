# Plan review: deploy-cloudflare-target

Reviewed against `change.md`, `research.md`, the roadmap block RP-8 and the code of `tools/deploy` and
`.github/actions/deploy`.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | A 0.8.0 bump breaks the `^0.7.0` ranges of agent-ready and backup's dependency on deploy. | Accepted: release 0.7.1 (plan updated). |
| 2 | Warning | The plan dropped the VPS path's tag guard (tag commit on the release branch); a dispatch could deploy any tag. | Accepted: a "Check the tag" step in the action with `tag` and `release-branch` inputs, tested on a throwaway repository. |
| 3 | Warning | Secrets in a file: a failed deploy step could leave it behind. | Accepted: an `always()` cleanup step and a test that the file is gone after a failing fake `wrangler`. |
| 4 | Suggestion | `secrets.required` in `wrangler.jsonc` makes wrangler refuse a deploy that misses a secret, a second line next to the action's own check. | Accepted: written from `--env`. |
| 5 | Suggestion | Rollback after a verify failure must not run when the deploy itself failed (nothing new to roll back). | Accepted: condition `failure() && steps.deploy.outcome == 'success'`, asserted in the test. |
| 6 | Suggestion | The roadmap names a reusable workflow; the plan builds an action. | Accepted as a recorded decision (environment secrets by name, SOFTURE/AI#468). |

Verdict: ready to implement with the fixes above applied to `plan.md`.
