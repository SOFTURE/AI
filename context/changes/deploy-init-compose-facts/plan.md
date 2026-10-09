# Plan: deploy-init-compose-facts

Input: change.md (research and framing skipped, reasons under Process notes). Complexity: small (two phases, one
package).

## Goal

`softure-deploy init` reads the Postgres major and the app's database role from an existing
`docker/prod/docker-compose.yml` and writes them into `deploy.sh` (and into a compose file it writes with `--force`);
the callers it writes, the examples and the README pin SOFTURE/AI's workflows by commit (`--workflows-ref`), not by the
missing `deploy-workflows-v1` tag.

**Out of scope:** a YAML parser dependency, an answer for the Postgres version of a brand-new app (the compose file
`init` writes and `deploy.sh` agree by construction), creating or moving any tag, a release.

## Findings (the reading behind the plan)

- `tools/deploy/src/init/generate.ts`: `TEMPLATE_VERSIONS.postgres = "16"` feeds `postgresVersion` into
  `docker-compose.yml.tmpl` (`image: postgres:{{postgresVersion}}`) and `deploy.sh.tmpl` (`TOOLS_IMAGE=…-pg{{…}}`,
  `postgresql{{…}}-client`, the header). `REPORT_ROLE=softure_app` is a literal in `deploy.sh.tmpl`.
- `tools/deploy/src/init/app-facts.ts` `readAppFacts` reads `package.json` and `next.config.*`; `AppFacts` is public and
  built by hand in `generate.test.ts` and `server-files.test.ts`. `scripts/write-e2e-app.ts` reads the example app,
  which has no `docker/prod/` (so `e2e/app/` does not change).
- `deploy.sh.tmpl` addresses the services `app` and `postgres` by name (`compose exec -T app`, `compose up … postgres`).
- `tools/deploy/src/cli/init-command.ts` `listWarnings` prints `warning <text>` lines before the summary.
- `deploy-workflows-v1` appears in `templates/.github/workflows/{deploy,release}.yml.tmpl`, `examples/{deploy,release,
  integration}.yml`, README §Deploy workflow, `src/init/generate.test.ts` and `tests/repo/deploy-workflows.test.ts`.
  `git ls-remote --tags origin` lists `deploy@0.1.0` … `deploy@0.1.6` (0.1.6 peels to `8d8b8e5…`), no
  `deploy-workflows-v1`.

## Key decisions

- **D1 compose facts.** A new pure module `src/init/compose-facts.ts`, `readComposeFacts(text)` →
  `{ postgresMajor: string | null; appDatabaseRole: string | null }`, line based: the services are the keys one level
  under `services:`; `postgresMajor` comes from the `image:` of the service `postgres` (tag of the last path segment,
  `17-alpine` → `17`, `pg17` → `17`, `17.2` → `17`; no tag, a variable or anything else → null); `appDatabaseRole` from
  the `DATABASE_URL` of the service `app` (map or list form, `postgres://` or `postgresql://`, the user part), held to
  `^[A-Za-z_][A-Za-z0-9_]{0,62}$` (it lands unquoted in bash), else null. No YAML parser: the package has none, and
  the two values are single scalars.
- **D2 facts field.** `AppFacts.compose?: ComposeFacts | null`: `null` when the app has no compose file, absent when
  the facts are built by hand; both mean the defaults.
- **D3 values.** `postgresVersion = compose?.postgresMajor ?? TEMPLATE_VERSIONS.postgres`, new value
  `reportRole = compose?.appDatabaseRole ?? "softure_app"`; `deploy.sh.tmpl` takes `REPORT_ROLE={{reportRole}}`.
  When `--force` replaces the app's compose file (`replacesCompose`), the role is `softure_app` (init's compose file
  connects as it) while the major still comes from the old file, so the data volume keeps its major (review F1).
- **D4 warnings.** With a database and a compose file init keeps, a value that cannot be read is a warning naming the file and
  the default used (`Postgres 16`, `softure_app`), so the header never silently lies.
- **D5 workflow ref.** `--workflows-ref=<40 hex>` (answer `workflowsRef`, optional) is written into both callers'
  `uses:`; without it `master`, and a warning names the command that prints the commit of `deploy@<cli version>`
  (`git ls-remote https://github.com/SOFTURE/AI 'refs/tags/deploy@<v>^{}'`), printed only when a caller was written.
  Examples use `master` with the same comment. A tag cannot be created from this change; `@` in a ref such as
  `deploy@0.1.6` is not relied on in `uses:`.

## Phase 1: compose facts and the workflow ref (TDD)

**Discipline:** TDD. **Files:** `src/init/compose-facts.ts` (+ test), `app-facts.ts`, `answers.ts`, `generate.ts`,
`src/cli/init-command.ts`, `templates/docker/server/deploy.sh.tmpl`, `templates/.github/workflows/*.tmpl`,
`src/init/generate.test.ts`, `tests/init-cli.test.ts`.

- Unit: `readComposeFacts` on the template's own compose, FIRE's shape (`postgres:17-alpine`, `fire_tracker_app`),
  list-form environment, `pgvector/pgvector:pg17`, no tag, a variable image, a role from a variable, no `app` service.
- CLI: an app with a kept PG17 compose file gets `-pg17`, `postgresql17-client` and `REPORT_ROLE=fire_tracker_app`;
  an unreadable image warns; `--workflows-ref=<sha>` lands in both callers and silences the ref warning; a bad ref is
  refused; without it `@master` and the warning.

Done when: the new tests were seen red, then green; gates green.

## Phase 2: docs

**Discipline:** test-after (docs). **Files:** `tools/deploy/README.md`, `tools/deploy/CHANGELOG.md`,
`tools/deploy/examples/*.yml`, `tests/repo/deploy-workflows.test.ts`.

- README `init`: the new flag and "Read from the app" line; §Deploy workflow: pin a commit SHA, how to find it, the
  tag does not exist. CHANGELOG `## Unreleased`.

Done when: gates green (typecheck, lint, test, build).

## Risks and rollback

- An unusual compose layout (anchors, a service named otherwise) reads as null: defaults plus a warning, as before
  this change. Rollback: revert the phase commits.

## Decisions (auto)

- Tag vs SHA → SHA pin documented, `--workflows-ref` for `init` (the coordinator's brief: no tag from this change).
- Default ref without the flag → `master` plus a warning (the workflows work out of the box; the warning gives the
  immutable pin).
- `--postgres-version` answer → no (the compose file `init` writes and `deploy.sh` share one value; the issue's gap is
  the kept file).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: compose facts and the workflow ref

#### Automated
- [ ] 1.1 Unit and CLI tests seen red, then green
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: docs

#### Automated
- [ ] 2.1 README, CHANGELOG, examples and the repo test, gates green (typecheck, lint, test, build)
