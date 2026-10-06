# Plan: deploy-verify-cert-expiry

Input: change.md, research.md. Complexity: small (one schema key, one check, the report and the command).

## Goal

`verify.tlsMinDays` (optional whole number, 1 to 365): `softure-deploy verify <https-url>` reads the peer certificate
once and prints a `tls` row, for example `PASS  -  tls  41 days left (until 2026-11-16), issuer Let's Encrypt`; fewer
days than the minimum, an untrusted certificate, a handshake error or an `http://` URL fail the row and the run.

**Out of scope:** checking every host of absolute redirect targets; OCSP or chain details; a `tlsMinDays` in the
`init` starter.

## Approach

**Chosen:** a separate check next to the routes. `src/verify/tls-check.ts` holds a pure `checkCertificateExpiry`
(certificate facts, minimum, now → `TlsReport`) and `runTlsCheck` (opens the connection, never throws). `runVerify`
returns `{ routes, tls }` with `tls: null` when the key is absent; the report prints the `tls` row after the routes
and counts it in the summary. **Rejected:** a fake route `tls` inside `RouteReport` (no status, no URL path; it
would blur the type); reading the certificate through `fetch` (undici does not expose it).

## Phase 1: Schema and the check

**Discipline:** TDD.
**Files:** `src/verify/schema.ts`, `schema.test.ts`, `schema/deploy.schema.json`, `src/verify/tls-check.ts`,
`tls-check.test.ts`, `src/verify/index.ts`.

1. `tlsMinDays: z.int().min(1).max(365).optional()` with `.describe()`; schema tests for a valid value, 0 and a
   fraction; regenerate the JSON Schema.
2. `checkCertificateExpiry`: passes at exactly the minimum, fails one day under, fails when untrusted (names the
   reason), floors partial days; the detail names days, date and issuer (`O`, else `CN`).
3. `runTlsCheck` against a local `tls.createServer` with an `openssl` certificate: trusted via `ca` and long enough
   passes; too short fails; untrusted (no `ca`) fails with the reason; a closed port fails with the code; an `http`
   URL fails without connecting; a server that never answers the handshake fails within the timeout.

## Phase 2: Engine, report, command, docs

**Discipline:** TDD.
**Files:** `src/verify/run-checks.ts`, `run-checks.test.ts`, `src/verify/report.ts`, `checks.test.ts` or a report
test, `src/cli/verify-command.ts`, its CLI test, `README.md`, `package.json` (patch bump).

1. `runVerify` returns `{ routes, tls }`; the TLS check runs alongside the routes with the same timeout.
2. `formatVerifyReport` prints the `tls` row (status `-`) and the summary `…, 1 failed; certificate failed`.
3. The command exits 1 when the routes or the certificate fail and says which.
4. README: the key, the row, Cloudflare's edge certificate; the limitation line goes. `@softure-ai/deploy` 0.1.1.
5. Gates: typecheck, lint, test, build.

## Progress

#### Automated
- [ ] Phase 1: schema and the check
- [ ] Phase 2: engine, report, command, docs
