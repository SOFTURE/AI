# Implementation review: deploy-row-count-config

Date: 2026-10-06 · Verdict: approved

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Plan adherence | PASS | two phases as planned: the `database` key with its JSON Schema, then `row-counts` and the shared reader |
| Intent | PASS | `row-counts` without `--tables` counts `database.rowCountTables` of `deploy.json`; `--tables` unchanged |
| Tests | PASS | 6 schema cases (valid, empty, bad name, three parts, duplicate, unknown key); 7 CLI cases, 2 of them on a real Postgres (`--out` then `--compare` from the file, `--config` naming another file); exact messages asserted |
| Errors | PASS | neither flag nor list and both flags are usage errors (exit 2) that say how to name the tables; an invalid or unreadable file is exit 1 with the zod issues; a broken `deploy.json` does not affect `--tables` |
| Security | PASS | names from the file pass the same pattern as `--tables` before they are quoted into SQL; the file is parsed with zod at the boundary |
| Conventions | PASS | every schema key described (JSON Schema adds `uniqueItems`), `verify`'s messages unchanged byte for byte, English only |
| Docs | PASS | usage text, the `row-counts` and `deploy.json` sections of the package README; `@softure-ai/deploy` 0.1.1 |

Findings:

- **W1 (warning):** the package bump moves the `deploy-cli-version` default of `deploy-app.yml` to 0.1.1, which a
  repository test keeps equal to the package version. Accepted: the release that carries this change is the one
  the workflow should pin; DF-2 and DF-7 change the same file and merge `master`.
- **S1 (suggestion), gap:** the server's `deploy.sh` still passes `--tables` baked in by `init`, because the server
  has no `deploy.json` before DF-7. Recorded as DF-8 (`deploy-row-count-server-list`).

Gates: typecheck, lint, test (3638 passed with `SOFTURE_TEST_POSTGRES_URL` set; the two repository failures of the
first run, a moved link and the workflow default, are fixed above) and build.
