# Plan: deploy-verify-origin-firewall

Input: change.md, backlog-input.md, DF-1 research §5. Complexity: small (one check, the report, the command, one
workflow input).

## Goal

`softure-deploy verify <url> --origin=<host>[:<port>]` opens one TCP connection to the origin (port 443 by default)
alongside the routes and prints an `origin` row, for example
`PASS  -  origin  203.0.113.7:443 no answer within 10000 ms (dropped)`. A connection that is accepted fails the row
and the run (exit 1): direct HTTPS reaches the server, so the firewall lets more than the CDN through. Without the
flag nothing changes. `deploy-app.yml` gets an optional `origin-address` input passed as `--origin`.

**Out of scope:** probing other ports (SSH stays open for the deploy); a key in `deploy.json` (the address is not
committed); reading the address from DNS history.

## Decisions

- **D1: fail, not warn.** The item says a loosened firewall fails the release, and a warning in FIRE was not acted
  on. A run without `--origin` does not check, as today.
- **D2: the address comes from the command line**, never from `deploy.json`: an IP in a committed file tells
  everyone where to go around the CDN. The workflow takes it as an input that callers fill from a repository
  variable (`${{ vars.DEPLOY_IP }}`, FIRE's name).
- **D3: TCP connect, not an HTTPS request.** FIRE runs `curl https://$IP/`, whose certificate check fails on an
  open origin with a certificate for the domain only, so curl prints `000` and the check passes although the server
  answered. A TCP handshake that completes is the answer that matters. Outcomes: accepted → fail; timeout
  (dropped), `ECONNREFUSED` (nothing listens), `EHOSTUNREACH`, `ENETUNREACH`, `ECONNRESET` → pass with the reason;
  a name that does not resolve or any other error → fail, because nothing was checked.
- **D4: same timeout as the routes** (`verify.timeoutMs` or `--timeout`); a dropping firewall makes the row take
  the whole timeout, in parallel with the routes.
- **D5: a separate `origin` field** on `VerifyReport` (`null` without the flag), like `tls`; the report prints it
  after `tls` and the summary adds `; origin passed|failed`.
- **D6: the workflow refuses `origin-address` with an empty `deploy-config`**: the verify step that carries the flag
  runs only with a config, so the check would be skipped silently.

## Phase 1: The check

**Discipline:** TDD.
**Files:** `src/verify/origin-check.ts`, `origin-check.test.ts`, `src/verify/index.ts`.

1. `parseOriginAddress(text)`: `host`, `host:port`, `[v6]`, `[v6]:port` and a bare IPv6 address; refuses empty
   text, a scheme, a path, credentials and a port outside 1-65535.
2. `classifyOriginProbe` (pure): the outcome of the connection → `OriginReport` (`passed`, `detail`).
3. `runOriginCheck`: a local listening port fails; a closed port passes (`ECONNREFUSED`); a name under `.invalid`
   fails; the socket is destroyed on every path.

## Phase 2: Engine, report, command, workflow, docs

**Discipline:** TDD.
**Files:** `src/verify/run-checks.ts`, `run-checks.test.ts`, `src/verify/report.ts`, `report.test.ts`,
`src/cli/verify-command.ts`, `src/cli/run.ts` (usage), `tests/verify-cli.test.ts`, `.github/workflows/deploy-app.yml`,
`tests/repo/deploy-workflows.test.ts`, `tools/deploy/examples/deploy.yml`, `README.md`.

1. `runVerify({ origin })` returns `{ routes, tls, origin }`.
2. `formatVerifyReport` prints the `origin` row and the summary part.
3. The command reads `--origin` (exit 2 on a bad address) and exits 1 naming the origin when it fails.
4. Workflow: input `origin-address` (default empty), checked in the `check` job (a host or IP with an optional port;
   refused with an empty `deploy-config`), passed to the verify step through `env:` and added as `--origin` only
   when set. The repository test pins both.
5. README and the example caller (commented `origin-address: ${{ vars.DEPLOY_IP }}`); the DF-13 line under "Parity
   with FIRE_TRACKER" goes. `@softure-ai/deploy` stays 0.1.3 (unreleased).
6. Gates: typecheck, lint, test, build.

## Progress

#### Automated
- [x] Phase 1: the check
- [x] Phase 2: engine, report, command, workflow, docs (both phases land in one commit; each was test-first in the working tree)
