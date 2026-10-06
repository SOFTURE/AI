# Plan review: deploy-row-count-config

Date: 2026-10-06 · Verdict: approved

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Intent coverage | PASS | optional `database.rowCountTables` in zod and JSON Schema; `row-counts` reads it without `--tables` |
| Scope | PASS | `src/db/`, the `row-counts` command, one schema key; `deploy.sh` left to DF-7 and recorded as a gap |
| Parallel work | PASS | DF-6 adds a sibling key in the same file; the regenerated JSON Schema is the only expected conflict |
| Security | PASS | names validated by the same pattern before they are quoted into SQL; the file is parsed at the boundary with zod |
| Testability | PASS | config errors need no database; the counting runs on the CI Postgres service like DP-3's tests |
| Conventions | PASS | zod at the boundary, result values, every schema key described, options unchanged for existing callers |

Findings:

- **W1 (warning):** moving `verify`'s file reading into a shared module touches `verify-command.ts`, which DF-6 may
  also change. Accepted: the move is one function; its messages stay byte for byte, so the existing verify tests
  guard it; the second to merge resolves.
- **S1 (suggestion):** `run.ts` usage must show both forms (`--tables` or `--config`), otherwise `--help` still
  reads as if `--tables` were required. Taken into Phase 2.
- **S2 (suggestion):** the README's `deploy.json` section (under `verify`) should show the `database` key too, so an
  app finds it where it already reads about the file. Taken into Phase 2.
