# Plan: deploy-init-release-caller

Input: change.md (research and framing skipped, reasons there). Complexity: low (one template, one list entry, test
and README lines).

## Goal

`softure-deploy init` writes `.github/workflows/release.yml`, the caller of `deploy-cut-release.yml`, next to
`deploy.yml`; an existing file is kept unless `--force`.

**Out of scope:** a `--timezone` or `--tag-prefix` flag (decided in change.md), `deploy-cut-release.yml` itself, the
server files and the e2e app, any version bump (0.1.3 is unreleased).

## Approach

**Chosen:** a template `templates/.github/workflows/release.yml.tmpl` whose YAML body is the example's
(`tools/deploy/examples/release.yml`) and whose header says `init` generated it (`{{name}}`, `{{cliVersion}}`, as the
deploy caller's header does). One entry in `TEMPLATE_FILES` right after the deploy caller, `isIncluded: always`,
mode 0644. A test parses the generated file and the example and requires the same YAML, so the two cannot drift; the
example's own repository test (dispatch only, permissions, declared inputs, the deploy caller's `tag` input) then
covers the generated one too.

**Rejected:** reading the example file at runtime as the template (the example sits outside the published `files`
of the package and has a copy-me header); rendering the caller from code (every other file is a template).

## Phase 1: init writes release.yml

**Discipline:** test-first (the planning and CLI tests name the new file before the template exists).
**Files:** `tools/deploy/src/init/generate.test.ts`, `tools/deploy/tests/init-cli.test.ts`,
`tools/deploy/templates/.github/workflows/release.yml.tmpl`, `tools/deploy/src/init/generate.ts`,
`tools/deploy/src/cli/run.ts`, `tools/deploy/README.md`.

1. Tests: the planned file list includes `.github/workflows/release.yml` after `deploy.yml`, mode 0644; the generated
   caller parses to the same YAML as `examples/release.yml` and its header names the app and the CLI version; the CLI
   reports it as `wrote` and counts it (`10 written`, `7 written, 1 kept`, `8 written`); a kept `release.yml` stays
   byte for byte and is named `kept`.
2. Template and list entry as in the approach.
3. The `init` line of the CLI help names the release workflow. README: the row in `init`'s file table; "Cut a
   release" says `init` writes the caller (the example stays for apps that ran `init` before).
4. `npm run e2e-app -w @softure-ai/deploy` leaves `e2e/app/` unchanged; `package.json` `files` already ships
   `templates/` (check the `.github` folder is packed: `npm pack --dry-run`).
5. Gates: typecheck, lint, test, build; actionlint over a generated `release.yml` when available.

## Progress

#### Automated
- [x] Phase 1: init writes release.yml (tests red before the template, then green) — `0a0da49`

#### Manual
- [ ] Owner: the first real run of a generated `release.yml` in an app (after the release of `@softure-ai/deploy`
  0.1.3 and the `deploy-workflows-v1` tag moved, as in DF-12).
