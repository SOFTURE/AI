# Plan review: deploy-init-template

Date: 2026-10-06 · Verdict: approved

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Intent coverage | PASS | compose and Traefik rules, Dockerfile, `deploy.sh` with DP-3, caller for DP-2, `deploy.json` for DP-4; `--force`; temp-folder test and CI image build |
| Scope | PASS | owns `templates/`, `src/init/`, `init-command.ts`, the CI job; `run.ts`, README and `package.json` get one entry each |
| Unknown answered | PASS | flags for domain and image, the rest from `package.json` and the tree; `softure.config` not read, with the reason |
| Security | PASS | every value written into YAML, bash or a Traefik rule passes a narrow pattern; `.env.prod` 0600; Postgres on loopback only; no secret in a template |
| Testability | PASS | pure `planInitFiles`; exact outputs; cross-checks with `findRequiredNames`, `parseDeployConfig` and `deploy-app.yml`'s inputs |
| Conventions | PASS | zod at the boundary, result values, `CliFailure` for refusals, options objects, English only |

Findings:

- **W1 (warning):** the roles SQL is a copy of the ops recipe and can drift. Accepted with a test that fails when the
  two differ; the deploy package cannot read `@softure-ai/ops` at run time (an app may not install it).
- **W2 (warning):** `COPY . .` before `npm ci` gives up the dependency layer cache. Accepted: `file:` dependencies
  need the context; a BuildKit cache mount on `/root/.npm` keeps reinstalls fast. Noted in the template comment.
- **S1 (suggestion):** `deploy.sh` should refuse to run when `SSH_ORIGINAL_COMMAND` has extra words, so the forced
  command cannot be steered. Taken into Phase 2.
- **S2 (suggestion):** keep the previous tag in a file on the server and print it when a step fails, so a redeploy
  of the older tag is one "Run workflow". Taken into Phase 2.
- **S3 (suggestion), gap:** the server files are copied by hand; shipping them with each release goes to
  `deploy-followups`.
