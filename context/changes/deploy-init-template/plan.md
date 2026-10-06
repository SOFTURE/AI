# Plan: deploy-init-template

Input: change.md, research.md. Complexity: medium (templates, a renderer, one command, a CI job).

## Goal

`softure-deploy init --domain=<host> --image=<registry/name> [--dir=.] [--name=<slug>] [--paths=/,…] [--www]
[--acme-email=<email>] [--env=NAME,…] [--tables=a,b.c] [--force]` writes the app's deploy files from
`tools/deploy/templates/`, skipping (and naming) each file that exists unless `--force`, and prints what it wrote.

**Out of scope:** FIRE parity of the templates (DF-1); shipping the server files with each release (new gap); a
real deploy, server, DNS or certificate.

## Approach

**Chosen:** template files with a `.tmpl` suffix (`{{key}}` values, `{{#flag}}…{{/flag}}` and `{{^flag}}…{{/flag}}`
line sections) and a small strict renderer: an unknown key or an unclosed section is a bug and throws. Answers are
validated at the boundary (zod) so every value written into YAML, bash or a Traefik rule matches a narrow pattern.
A manifest maps each template to its target path, its condition and its mode (`deploy.sh` 0755).
**Rejected:** interactive prompts (the CI job and scripts need flags); a template engine dependency (two constructs
are enough); generating from code strings (the files are easier to review as files); reading `softure.config` (see
research).

## Phase 1: Renderer and answers

**Discipline:** TDD.
**Files:** `src/init/render-template.ts`, `src/init/answers.ts`, `src/init/app-facts.ts`, their tests.

1. `renderTemplate(text, values)`: values and sections; tag-only lines vanish; unknown key, unclosed or mismatched
   section throw.
2. `parseInitAnswers(unknown)` (zod): domain (lower-case host names), image (the workflow's image regex), name
   (`^[a-z][a-z0-9-]{0,39}$`), paths (`/` or prefixes of `[A-Za-z0-9._~/-]`), env names (upper snake case, not the
   ones the templates set, not reserved runner names), tables (`parseTableList`), email.
3. `readAppFacts(dir)`: `package.json` name, `@softure-ai/db` and `@softure-ai/ops` in dependencies, `public/`,
   `next.config.*` with `standalone`; a missing or invalid `package.json` is an expected failure.

## Phase 2: Templates and the generator

**Discipline:** TDD.
**Files:** `templates/**.tmpl`, `templates/docker/prod/initdb/01-roles.sql.tmpl` (a copy of the ops recipe),
`src/init/generate.ts`, `src/init/index.ts`, tests, `src/index.ts`.

1. Templates: `Dockerfile`, `.dockerignore`, `docker/prod/docker-compose.yml`, `docker/prod/traefik.yml`,
   `docker/prod/initdb/01-roles.sql` (database), `scripts/migrate.ts` (database), `docker/server/deploy.sh`,
   `.github/workflows/deploy.yml`, `deploy.json`.
2. `planInitFiles({ answers, facts, cliVersion })` → `{ path, text, mode }[]` (pure); `writeInitFiles` writes new
   files, skips existing ones unless `force`, never follows a target outside `dir`.
3. Tests: exact output for one app with a database; without a database (no Postgres, no DP-3 steps); restricted
   paths and `www`; the compose file's required names are exactly what `deploy.sh` and the app need
   (`findRequiredNames`); `deploy.json` passes `parseDeployConfig`; the caller passes the same checks as the
   example caller against `deploy-app.yml`; the roles file equals `modules/ops/recipes/initdb/01-roles.sql`.

## Phase 3: CLI, CI image build, docs

**Discipline:** TDD for the command; the image build is verified by running it.
**Files:** `src/cli/init-command.ts`, `src/cli/run.ts`, `tests/init-cli.test.ts`, `scripts/init-image.mjs`,
root `package.json` (`e2e:deploy-init`), `.github/workflows/e2e.yml` (job), `package.json` (`files`: templates),
`README.md`, roadmap and status rows.

1. `init` flags; usage errors exit 2; refused answers exit 1 with every problem; output lists written and skipped
   files and the warnings.
2. `scripts/init-image.mjs`: stage the example app as a standalone app (tracked files, packed workspace tarballs in
   `vendor/`, a fresh lockfile), run the built `init`, `docker compose config` with placeholder values, `bash -n`
   and `shellcheck` on `deploy.sh`, `docker build`. CI job `deploy-init` in `e2e.yml`.
3. Gates: typecheck, lint, test, build; the image build run locally.

## Progress

#### Automated
- [ ] Phase 1: renderer and answers
- [ ] Phase 2: templates and the generator
- [ ] Phase 3: CLI, CI image build, docs

#### Manual
- [ ] (owner, after DP-8) run `softure-deploy init` in FIRE_TRACKER's shape of app and compare with its `docker/**`
