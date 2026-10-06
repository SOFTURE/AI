# Plan: deploy-row-count-server-list

Input: change.md, research.md. Complexity: low (two templates, one value in `generate.ts`, tests, README).

## Goal

`init`'s `deploy.sh` counts the tables of `database.rowCountTables` in the `deploy.json` the release shipped
(`releases/<tag>/deploy.json`) with `row-counts --config=<that file>`, before and after the switch; without the file
or the key it skips the comparison, as an empty list does today. `init --tables` writes the list into the generated
`deploy.json` (apps with a database) and no longer into the script.

**Out of scope:** counting a table the old schema lacks (new gap DF-9); the workflow (DF-3 owns it now); a version
bump (0.1.3 is unpublished and carries DF-7 already).

## Approach

**Chosen:** in the database part of the template, `ROW_COUNT_TABLES` goes; `release_config="$release_dir/deploy.json"`
(absolute: `release_dir` is under `$APP_DIR`). A `node -e` check exits 0 for a non-empty array, 3 for no file or no
key; any other status fails the release with "cannot read the row-count tables of deploy.json". When the check says
yes and there is a previous tag, `row-counts --config="$release_config" --out=…` before and `--compare=…` after the
switch. `deploy.json.tmpl` gets a `{{#hasRowCountTables}}` line `"database": { "rowCountTables": [...] },` before
`verify`; `buildValues` sets `hasRowCountTables` (database and at least one table) and `rowCountTablesJson`.

**Rejected:** reading the installed `deploy.json` next to the script (a release that stops shipping it would count a
stale list); a new `row-counts` flag that turns "no list" into success (CLI surface for one caller, and exit 2 already
means usage); `jq` (not a host requirement).

## Phase 1: deploy.sh reads the shipped list

**Discipline:** test-first.
**Files:** `tools/deploy/tests/server-files.test.ts`, `tools/deploy/src/init/generate.test.ts`,
`tools/deploy/templates/docker/server/deploy.sh.tmpl`, `tools/deploy/templates/deploy.json.tmpl`,
`tools/deploy/src/init/generate.ts`, `tools/deploy/README.md`.

1. Test (`server-files.test.ts`, new describe for an app with a database): stub `docker` and `npx` on `PATH` (the
   stub logs its arguments), `.env.prod` with `POSTGRES_PASSWORD`; a second release whose `deploy.json` lists tables
   calls `row-counts --config=<srv>/releases/v2/deploy.json --out=…` before the switch and `--compare=…` after it,
   in that order; the first release calls no `row-counts`; a release with `deploy.json` without the key, or with no
   `deploy.json` at all, calls none and goes live; an unparsable `deploy.json` fails before the switch with the
   message above.
2. Test (`generate.test.ts`): `deploy.json` carries `database.rowCountTables` equal to the answers' tables and
   `parseDeployConfig` accepts it; no `database` key without tables or without a database; `deploy.sh` holds no
   table names and no `ROW_COUNT_TABLES`; the order assertion uses `--config=`.
3. Template and `generate.ts` as above; header comment of `deploy.sh` and the README (`init --tables`, the server
   steps, the DF-8 limitation removed, "a table joins the list after the release that creates it").
4. Gates: typecheck, lint, test, build; shellcheck over both rendered `deploy.sh` variants.

## Phase 2: record the gap

1. DF-9 (`deploy-row-count-new-table`) in the roadmap, its backlog entry and the backlog README.

## Progress

#### Automated
- [ ] Phase 1: deploy.sh reads the shipped list (tests red before the templates, then green)
- [ ] Phase 2: gap DF-9 recorded

#### Manual
- [ ] Owner: the release of `@softure-ai/deploy` 0.1.3 (with DF-7); an app moves its tables from `deploy.sh` into
  `deploy.json` when it takes the new script.
