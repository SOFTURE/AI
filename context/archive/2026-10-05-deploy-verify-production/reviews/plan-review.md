# Plan review: deploy-verify-production

Date: 2026-10-05 · Verdict: approved

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Intent coverage | PASS | statuses, markers, redirects, headers from `deploy.json`; table; non-zero exit; JSON Schema published |
| Scope | PASS | owns `src/verify/`, `schema/`, `scripts/`, `verify-command.ts`; the shared `run.ts` change is minimal (async) |
| Unknown answered | PASS | TLS through `fetch`, robots as a route, security headers as a global map; expiry window and FIRE parity are gaps |
| Security | PASS | no production request in tests; base URL without credentials; paths cannot leave the host (`//` refused); no shell |
| Testability | PASS | real local `node:http` server; `runCli` in process; fixed ports avoided (port 0) |
| Conventions | PASS | zod at the boundary, result values, `CliFailure` for refusals, every schema key described |

Findings:

- **W1 (warning):** `runCli` turning async touches the shared CLI entry DP-3 may change the same way. Accepted:
  master is the source of truth; the second to land merges.
- **S1 (suggestion):** send `cache-control: no-cache` so a CDN in front (Cloudflare) does not answer with the old
  release. Taken into Phase 2.
- **S2 (suggestion):** with a path prefix in the base URL (`https://host/app`), join the route path to it instead of
  replacing it. Taken into Phase 2.
