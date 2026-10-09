# Plan review: deploy-verify-env

Reviewed plan.md against change.md, issue #357, `deploy-app.yml` and its tests on master. Mode: autonomous (decisions
taken, recorded here).

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | `toJSON(secrets)` in the verify step's environment would reach `npx` and the CLI it downloads (every secret, `github_token` included). | Accepted in the plan: the CLI runs under `env -u VERIFY_ENV` with only the chosen names added. Tested. |
| F2 | Warning | GitHub masks a secret as a whole; the entries of a `verify-env` JSON secret are not masked on their own, and a multi-line value is masked per line only when registered per line. | Accepted: the step registers `::add-mask::` for every non-empty line of every value before running anything. Tested. |
| F3 | Suggestion | A whitespace-only `verify-env-names` would put the verify job in the environment with nothing to export. | Accepted: the check job refuses a value that lists no name. |
| F4 | Suggestion | `$(…)` strips trailing new lines; a PEM-style value would lose its last one. | Accepted: values are read with a sentinel character. Tested. |

No finding blocks the plan.
