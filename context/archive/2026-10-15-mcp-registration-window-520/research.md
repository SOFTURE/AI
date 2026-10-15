---
change_id: mcp-registration-window-520
---

# Research: mcp-registration-window-520

Sources: `modules/mcp-access/src/server/oauth-http.ts` (`handleClientRegistration`), `src/options.ts` (`oauthSchema`),
`src/index.ts` (manifest), `module.json`, `migrations/0002_create_oauth_grants.sql`, `src/server/health.ts`,
`modules/auth/src/scripts/role-scripts.ts` and `modules/ops/src/scripts/ops-script.ts` (ops script pattern),
`modules/auth/src/server/switches.ts` (`auth.registration_closed`).

- `handleClientRegistration` checks `isOAuthEnabled` (404), then the `mcp-oauth` rate limit, then reads the capped
  body and registers. A gate fits after the rate limit, before the body read: probes still count, nothing is parsed.
- Errors go through `protocolError(error, description, status)`: CORS + no-store JSON, the RFC 7591 shape.
- Switches (`readSwitch`) answer a boolean from feature-switches; nothing there expires, so "open for N minutes"
  needs its own stored time. The issue's own workaround is a one-row `open_until` table.
- Ops scripts: `defineOpsScript({ name, description, usage, args, run(tx, args) })`, `run` returns
  `ok({ before, after })` or `refuseOpsScript(reason)`; tests use `executeOpsScript(db, script, args, { commit })`.
  Auth exports them from `./scripts` with `@softure-ai/ops` as an optional peer and `"ops": "^0.2.0?"` in dependsOn.
- The manifest lists `tables` and its copy `module.json` must match (module test); the health check selects from each
  OAuth table with `limit 0`.
- Migrations run per module inside the `mcp` schema; a new file `0003_…sql` with a rollback comment.
