# Implementation review: deploy-fire-parity

Reviewed 2026-10-06: the branch `claude/project-thread-sxdn77` against plan.md (five phases), change.md and
research.md, after merging `master` `60ca018`. Verdict: **approve**; one finding fixed, the rest accepted as they are.

## Plan drift

None. Phases 1–5 landed as planned with the plan-review fixes (P1–P7). The `backup` API stayed backward compatible:
`selectExpiredBackups(names, prefix, keep)` kept its signature and the age limit is a new `selectAgedBackups`; the
new `createBackup` options are optional.

## Checks against the code

- **Red before green:** the `--exclude-table-data` cases failed with the exclusions removed from the `pg_dump`
  arguments (the argument test and the real Postgres test, which reads `pg_restore --list`), and the method/body/header
  case of `verify` failed with the request forced back to `GET` with the fixed headers.
- **Real Postgres:** `tests/db-cli.test.ts` ran against a local PostgreSQL 16 (`SOFTURE_TEST_POSTGRES_URL`): 19 of 19,
  including the new excluded-table case. Without the variable those cases skip, as before.
- **Defaults unchanged where promised:** `release-notes` without `--body`/`--roadmap` is byte-for-byte the old output
  (the existing tests are untouched); `backup` without the new flags passes the same `pg_dump` arguments; `verify`
  routes default to `GET` with no body and no extra headers. `env render` changes on purpose: one header line, and
  optional names when set.
- **Secrets:** no value reaches stdout or stderr; an unsafe optional value is refused by name like a required one.
- **DF-5 and DF-7 files:** `row-counts.ts`, `deploy-app.yml` and `deploy.sh.tmpl` are untouched; `parseTableList` is
  only imported.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | Warning | A `HEAD` route with `contains` or `excludes` would always fail: the response has no body to search. | Fixed: the schema refuses markers on `HEAD` ("a HEAD response has no body to hold markers"), with a test. |
| F2 | Suggestion | `env render` lists optional names after the required ones rather than in one sorted list. | Kept: required first reads as "what production needs, then the switches"; the order has no effect on compose. |
| F3 | Suggestion | A compose file using `${HOME:-…}` or `${PATH:-…}` would get the runner's value written, since the deploy workflow passes `PATH` and `HOME` to the CLI. | Kept: no generated or known compose file uses those names with a default; README states the rule for optional names. |
| F4 | Suggestion | `verify` runs a `POST` route on every run, alongside others. | Kept, documented in the README and the schema's description (P4): make it a no-op or a check request. |
| F5 | Suggestion | `--body` replaces only the first marker pair when a hand edit duplicated it. | Kept (P6), tested: the text around the first section, a stray marker included, stays as it is. |

## Gates

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (recorded in the PR before merge).

## Lessons

No new class of error: the one finding (F1) is a schema hole of a new key, caught by reading the diff.
