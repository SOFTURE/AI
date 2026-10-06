# Implementation review: deploy-init-template

Date: 2026-10-06 · Verdict: approved

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Plan adherence | PASS | three phases as planned: renderer and answers, templates and the generator, CLI with the CI image build |
| Intent | PASS | compose and Traefik rules, Dockerfile, `deploy.sh` with DP-3's steps, the DP-2 caller, a DP-4 `deploy.json`; existing files kept unless `--force` |
| Tests | PASS | renderer, answers, generator and CLI tests with exact outputs; the compose file's required names, `deploy.json` and the caller are checked against `findRequiredNames`, `parseDeployConfig` and `deploy-app.yml`; the roles file against the ops recipe |
| Errors | PASS | missing flags exit 2; invalid answers exit 1 with one line per problem and write nothing; an unreadable `package.json` is a refusal; template bugs throw |
| Security | PASS | every value written into YAML, bash or a Traefik rule passes a narrow pattern; `.env.prod` 0600, never sourced; Postgres on loopback; the forced command accepts only `deploy <tag>`; a forced write never follows a link |
| Conventions | PASS | zod at the boundary, result values, options objects, `CliFailure`, English only |
| Docs | PASS | package README section (files, answers, `deploy.sh` steps, host needs); usage text; DF-7 for the hand copy |

Findings:

- **C1 (critical), fixed:** on the first release `row-counts --out` failed because the tables did not exist yet, so a
  fresh server could never be deployed. Found by running the generated `deploy.sh` locally; it now counts only when a
  previous release is recorded, with a test.
- **W1 (warning), fixed:** a comment in the compose template spelled out the required-variable form, which
  `env render` would have read as a secret named `NAME`. The comment now describes the form in words.
- **S1 (suggestion), gap:** the server files are copied by hand; DF-7 (`deploy-server-files`).
- **S2 (suggestion):** `deploy.sh` does not roll back by itself when the row counts drop after the switch; it prints
  the previous tag and the backup folder. Kept: restoring data is a decision, and FIRE parity (DF-1) reads FIRE's
  behaviour.

Manual check (2026-10-06, this session's Docker): the example app staged as a standalone app, `init` run there, the
generated `Dockerfile` built; `docker compose up --wait app` migrated 25 files and `/api/health` answered 200 with
every module check; the generated `deploy.sh` ran twice through a forced-command call (backup, schema guard,
switch; then row counts before and after), Traefik served the apex with HSTS, redirected HTTP and answered 404 for
another host; `shellcheck` found nothing.
