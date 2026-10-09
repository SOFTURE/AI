# Plan review: deploy-environment-secrets

Reviewed plan.md against change.md, research.md, `deploy-app.yml` and its tests on master `8d8b8e5`. Mode: autonomous
(decisions taken, recorded here).

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | Under the flag `app-secrets` is the whole `secrets` context, which the app does not pick. A repository secret named `NODE_AUTH_TOKEN` (common for npm publishing) or `NPM_CONFIG_*` would stop every deploy at the reserved-name check, though no compose file can be rendered from it. | Accepted. Under the flag a reserved name in the secrets is left out and named in one notice line (never its value); in `app-vars` and in an explicit `app-secrets` it stays an error. A compose file that requires such a name still fails in `env render`, naming it. Tested. |
| F2 | Warning | `secrets: inherit` without the flag would now pass the call (no secret is required) and could reach the deploy job with empty SSH values. | Covered by the plan: the check job refuses each missing named secret without the flag, naming it and the flag. Tested. |
| F3 | Suggestion | The check job's `jq` call on `app-vars` runs under `bash -e`; invalid JSON must become a named refusal, not a bare `jq` error. | Accepted. The lookup ends in `|| true` and an empty result is refused as "the name of a string entry in app-vars". |
| F4 | Suggestion | The environment check step could run on the e2e path, where the SSH values come from the throwaway server and the environment has none. | Accepted as planned: the step runs only under the flag and not under `e2e`. |

No finding blocks the plan; F1 and F3 are folded into the implementation.
