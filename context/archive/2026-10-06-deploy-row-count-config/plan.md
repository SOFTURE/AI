# Plan: deploy-row-count-config

Input: change.md, research.md. Complexity: small (one schema key, one command option).

## Goal

`deploy.json` accepts `"database": { "rowCountTables": ["users", "billing.subscriptions"] }`, described in the
published JSON Schema. `softure-deploy row-counts [--config=deploy.json] [--out=…] [--compare=…]` counts those
tables when `--tables` is not given; `--tables` keeps working as before and does not read the file.

**Out of scope:** `init`'s `deploy.sh` and `deploy.json` template (DF-7 owns `deploy.sh`; the server has no
`deploy.json` before DF-7), recorded as a new gap; any other `deploy.json` key (DF-6 adds `verify.tlsMinDays`).

## Approach

**Chosen:** a `database` strict object in `deploySchema` with `rowCountTables` (array, at least one, unique, each
matching `TABLE_NAME_PATTERN` exported from `src/db/row-counts.ts`); the file reading of `verify` moves to
`src/cli/deploy-config.ts` (`readDeployConfig`, `DEFAULT_DEPLOY_CONFIG`) so both commands share it with their own
command prefix; `runRowCounts` resolves its table list from `--tables` or the config.
**Rejected:** silently preferring `--tables` when `--config` is also given (an explicit flag that does nothing hides
a typo); reading `deploy.json` even with `--tables` (a broken file would break a command that does not need it);
deduplicating the configured list (a duplicate in a file someone edits is a mistake worth naming).

## Phase 1: Schema

**Discipline:** TDD.
**Files:** `src/db/row-counts.ts`, `src/verify/schema.ts`, `src/verify/schema.test.ts`, `schema/deploy.schema.json`.

1. Tests: a valid list parses; an empty list, a bad name (`Users`, `a.b.c`) and a duplicate are refused with the
   path `database.rowCountTables…`; an unknown key under `database` is refused; a config without `database` stays
   valid.
2. `databaseSchema` with `.describe()` on every key; regenerate the JSON Schema.

## Phase 2: CLI

**Discipline:** TDD.
**Files:** `src/cli/deploy-config.ts`, `src/cli/verify-command.ts`, `src/cli/db-commands.ts`, `src/cli/run.ts`
(usage), `tests/db-cli.test.ts`, `README.md`.

1. Tests without a database (usage and config errors): no `--tables` and no `deploy.json` → exit 2 naming both
   ways; a `deploy.json` without the list → exit 2; an invalid `deploy.json` → exit 1 with its issues; `--tables`
   with `--config` → exit 2; `--tables` with a broken `deploy.json` in the folder still runs.
2. Tests on Postgres: the tables of `deploy.json` are counted (`--out`, then `--compare`), and `--config=<other>`
   names another file.
3. `readDeployConfig(command, path, shownPath)` shared with `verify` (its messages unchanged).
4. Usage line, README section of `row-counts` and the `deploy.json` section; bump `@softure-ai/deploy` to 0.1.1.
5. Gates: typecheck, lint, test (with `SOFTURE_TEST_POSTGRES_URL`), build.

## Progress

#### Automated
- [x] Phase 1: schema
- [x] Phase 2: CLI (also the `deploy-cli-version` default of `deploy-app.yml`, which a repository test keeps equal to the package version)

#### Manual
- (none: the owner step for the server's list is the DF-7 follow-up gap)
