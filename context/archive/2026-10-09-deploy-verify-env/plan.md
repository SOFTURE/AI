# Plan: deploy-verify-env

Input: change.md, issue #357, the research of `deploy-environment-secrets` (research skipped, reason in change.md).
Complexity: small (one phase).

## Goal

The verify step of `deploy-app.yml` runs `softure-deploy verify` with variables the app chose: from the secret
`verify-env` (secrets by name) or from the secrets `verify-env-names` lists (`secrets-from-environment`).

**Out of scope:** the end-to-end path (its verify runs in the deploy job with the test's own `deploy.json`, which has no
`webBotAuth` route); any change to the CLI.

## Key decisions

- **`verify-env` (secret, optional).** A JSON object of text values by name. Refused under `secrets-from-environment`
  (a caller with `secrets: inherit` cannot pass it; one source per path), naming `verify-env-names` instead.
- **`verify-env-names` (input, default empty).** Secret names separated by spaces or new lines; needs
  `secrets-from-environment`. Then the verify job runs in `environment` (`environment: verify-env-names != '' &&
  environment || ''`), so its `secrets` context holds the environment's secrets. Documented cost: a protected
  environment with required reviewers asks again for the verify job; a tag-only deployment policy does not.
- **Names.** `^[A-Za-z_][A-Za-z0-9_]*$`, and not reserved: the verify step's own variables (`APP_URL`,
  `DEPLOY_CONFIG`, `DEPLOY_CLI_VERSION`, `ORIGIN_ADDRESS`, `ORIGIN_ADDRESS_VAR`, `APP_VARS`, `VERIFY_ENV`,
  `VERIFY_ENV_NAMES`) and the runner's (`PATH`, `HOME`, `NODE_*`, `NPM_CONFIG_*`, as `env render` refuses), any case.
- **Check job.** Validates both before anything is built. It reads the `verify-env` secret itself (masked as a secret;
  errors name keys, never values). Both are refused with an empty `deploy-config`.
- **Verify step.** `VERIFY_ENV` is `toJSON(secrets)` when names are listed, else `secrets.verify-env`. The step masks
  every line of every exported value (an entry of a JSON secret is not masked on its own), fails naming a listed
  secret the job's context lacks, and runs `env -u VERIFY_ENV NAME=value… npx … verify`, so the variables reach the CLI
  only and the whole secrets JSON never does. Values keep trailing new lines (read with a sentinel). bash 3.2 only.

## Phase 1: workflow, docs (test-first)

Files: `.github/workflows/deploy-app.yml`, new `tools/deploy/tests/verify-env.test.ts`, `tools/deploy/README.md`,
`tools/deploy/CHANGELOG.md` (0.1.8), `tools/deploy/examples/deploy.yml` and `init`'s caller template (both pass
`verify-env`: a repository test requires every declared secret in them).

- Tests (fail on master): input and secret declared (default empty, not required); check step accepts each form on its
  path and refuses: a bad name, each reserved name, `verify-env` that is not an object or has a non-text value, names
  without the flag, `verify-env` under the flag, both with `deploy-config: ""`; the verify job's `environment`
  expression; the verify step exports the variables to the CLI (a stand-in `npx` prints its environment), masks each
  value line, keeps a trailing new line, does not pass `VERIFY_ENV` on, and names a listed secret that is missing.
- Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Revision after review (CodeQL, PR #365)

CodeQL's "Excessive Secrets Exposure" flagged `toJSON(secrets)` in the verify step: every organization and repository
secret reached the runner of a job that needs one key. Decision: `verify-env-names` is replaced by `verify-env-secret`,
the name of one environment secret holding the same JSON object as `verify-env`. The verify step reads only
`secrets[inputs.verify-env-secret]`, as the deploy job reads the SSH secrets. The name rules move into one jq program
(`VERIFY_ENV_RULES`, the same text in the check job and the verify step, a test keeps them equal); the check job applies
it to `verify-env`, the verify step to whichever secret it got (the environment secret is not readable earlier).

## Progress

- [x] Phase 1: workflow, docs, tests
- [x] Revision: one named environment secret instead of the whole secrets context
