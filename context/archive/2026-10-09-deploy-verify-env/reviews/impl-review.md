# Implementation review: deploy-verify-env

Reviewed the diff against plan.md and change.md. Mode: autonomous.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Suggestion | A `verify-env` key holding a new line splits into two names in the check job's `read` loop; each part may pass as a name. | Kept as is: the verify step splits the same way, finds no entry under the parts and fails naming them before the CLI runs, so nothing leaks or runs with a wrong variable. |
| F2 | Suggestion | Under `verify-env-names` the step's environment holds the whole secrets context (`toJSON(secrets)`), as the deploy job's render step already does. | Kept: GitHub masks each secret, and `env -u VERIFY_ENV` keeps it from `npx` and the CLI; a test asserts the CLI sees only the listed names. |

Acceptance (change.md): 1 and 2 are covered by the verify step tests (variables reach the stand-in CLI, masked, the
JSON does not); 3 by the check job tests (bad, reserved, wrong-path, empty `deploy-config`); 4 by the "neither" test
and the unchanged suites `environment-secrets.test.ts` and `tests/repo/deploy-workflows.test.ts`.

Gates: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`.
