# Plan: deploy-environment-secrets

Input: change.md, research.md (framing skipped, reason in change.md). Complexity: medium (two phases).

## Goal

`deploy-app.yml` takes `secrets-from-environment: true` with `secrets: inherit`: the deploy job builds the app's
secrets from its own `secrets` context (the environment's over the repository's) and reads the SSH values by name.
Without the flag, every call behaves as today.

**Out of scope:** releasing `@softure-ai/deploy` (#297 follows on the same package); moving the e2e to the new form
(acceptance 3 keeps it unchanged).

## Key decisions

- **Inputs.** `secrets-from-environment` (boolean, default false); `ssh-host-secret`, `ssh-user-secret`,
  `ssh-private-key-secret`, `ssh-known-hosts-secret` (names, defaults `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`,
  `DEPLOY_SSH_KEY`, `DEPLOY_SSH_KNOWN_HOSTS`, the names the example caller already uses); `origin-address-var`
  (default empty).
- **Required secrets.** The five named secrets become `required: false`: with `secrets: inherit` none of them can
  exist, and GitHub's call-time check would refuse the call. The check job takes over: without the flag it refuses a
  missing `ssh-host`, `ssh-user`, `ssh-private-key`, `ssh-known-hosts` or `app-secrets` by name, before anything is
  built (the only visible change for a current caller: the error comes from the check job instead of the call). It
  sees one env value listing the names passed (`secrets.x != '' && 'x' || ''`), never a value.
- **The flag in the check job.** Refused without `environment`; refused when any named secret (the five, or
  `origin-address`) is passed too (one source of truth); the four `*-secret` inputs must be secret names
  (`^[A-Za-z_][A-Za-z0-9_]*$`).
- **Deploy job.** A first step under the flag (not on the e2e path, which brings its own server) fails when any of the
  four SSH secrets is empty in the job's context, naming the secret and the environment, before anything is rendered.
  The render step's `APP_SECRETS` becomes `inputs.secrets-from-environment && toJSON(secrets) || secrets.app-secrets`;
  the reserved-name check stays. `env render` writes only the compose names, so `github_token` and the deploy key
  never reach `.env.prod`. The send step's values become `inputs.e2e && <e2e output> || inputs.secrets-from-environment
  && secrets[inputs.<name>-secret] || secrets.<name>`.
- **Origin address.** The verify job has no environment, and a job output holding a secret is dropped, so the deploy
  job cannot hand it over. Giving verify `environment:` too would ask for a second approval on protected environments.
  Instead `origin-address-var` names an `app-vars` entry (e.g. `DEPLOY_ORIGIN_IP` from `toJSON(vars)`); it works with or
  without the flag. The check job resolves it with `jq`, refuses it next to the `origin-address` secret, refuses a
  name that is not a string entry of `app-vars`, and then validates the address as today. The verify step resolves it
  the same way. The address is not secret (the README already says `vars.DEPLOY_IP` fits), so it is not masked.

## Phase 1: workflow (test-first where the steps run)

Files: `.github/workflows/deploy-app.yml`, new `tools/deploy/tests/environment-secrets.test.ts`,
`tools/deploy/tests/release-guards.test.ts` (check env gains the passed-secret list),
`tests/repo/deploy-workflows.test.ts` (send env strings, verify env, e2e caller's secrets).

- Tests: check step accepts the flag with an environment and `secrets: inherit`; refuses it without an environment,
  with a named secret, with a bad secret name; refuses each missing named secret without the flag; resolves
  `origin-address-var` from `app-vars` and refuses a missing entry, a non-string entry, invalid `app-vars` JSON, and
  both sources at once. The environment check step names each missing SSH secret and passes with all set. The render
  step, given what `toJSON(secrets)` holds under `secrets: inherit` (`github_token`, the deploy key, an unrelated
  secret) and the real CLI (through tsx), writes exactly the compose names. The send step's env reads the named secret
  under the flag. The verify step adds `--origin` from the `app-vars` entry.

Done when: `npx vitest run tools/deploy tests/repo` green, actionlint 1.7.12 clean on the workflow and the example.

## Phase 2: docs

Files: `tools/deploy/README.md` (Deploy workflow: inputs table, secrets paragraph, a paragraph on the environment
form), `tools/deploy/examples/deploy.yml` (the environment form, commented), `tools/deploy/CHANGELOG.md`
(`## Unreleased`).

Done when: all gates green (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`).

## Progress

- [x] Phase 1: workflow
- [x] Phase 2: docs, and the impl-review fixes (F1-F5)
