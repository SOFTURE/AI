# Implementation review: deploy-verify-production

Date: 2026-10-05 · Verdict: approved

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Plan adherence | PASS | three phases as planned: schema and JSON Schema, checks and runner, async CLI |
| Intent | PASS | status, markers (present and absent), redirects, headers (value and absence); table; exit 1 on a failure |
| Tests | PASS | 80 package tests; the runner and the CLI run against a real `node:http` server on port 0; exact outputs asserted |
| Errors | PASS | network, TLS and timeout errors are a failed `request` row, not a throw; config problems are one line per zod issue; usage errors exit 2 |
| Security | PASS | no request outside localhost in tests; base URL without credentials (refused before any request, never echoed); `//` paths refused; no shell |
| Conventions | PASS | zod at the boundary, result value from `parseDeployConfig`, options objects, every schema key described, English only |
| Docs | PASS | package README section with an example `deploy.json` validated against the schema; root README line; usage text |

Findings:

- **W1 (warning):** `runCli` is now async, a change to the shared CLI entry that DP-3 may also make. Accepted:
  the change is two lines in `run.ts` and one in `main.ts`; the existing tests await it.
- **S1 (suggestion), gap:** parity with FIRE_TRACKER's `verify-production.sh` could not be checked (FIRE_TRACKER
  could not be read from this session). Folded into DF-1 (`deploy-fire-parity`).
- **S2 (suggestion), gap:** a certificate close to expiry passes until it expires. Recorded as DF-4
  (`deploy-verify-cert-expiry`).
- **S3 (suggestion):** bodies are read whole when a marker needs them. Kept: verify reads the app's own pages,
  and the timeout bounds a slow body.

Manual check: the built bin (`dist/cli/main.js verify`) against a local server printed the table, named the wrong
redirect target and exited 1.
