---
change_id: mcp-access-write-switch-consent-host-904-906
---

# Research

- Switch contract: `readSwitch(ctx, name)` in `foundation/core/src/switches.ts` answers `{ kind: "value", isEnabled }`
  or `{ kind: "undeclared" }`; the provider (`@softure-ai/feature-switches`) resolves env override, stored row, default
  and fail mode itself and never throws on a database failure. `auth.registration_closed` is the model
  (`modules/auth/src/server/switches.ts`, manifest `switches`, `module.json`). Names must match
  `<kebab scope>.<snake key>`, so `mcp-access.writes_enabled` is valid; its env override is
  `SOFTURE_SWITCH_MCP_ACCESS_WRITES_ENABLED` (feature-switches `getSwitchEnvName`).
- Places that decide write access today from `allowWrites` alone:
  - `src/server/endpoint.ts`: the challenge's `requiredScopes` and the verified token's scopes (→ `identity.canWrite`,
    so the app's factory registers no write tools);
  - `src/server/oauth-http.ts`: the default scope of an authorization request without `scope`
    (`isWriteRequestedOrDefault`) and the decision's `canWrite`;
  - `src/next/oauth-page.tsx`: `isWriteOffered`;
  - `src/stdio/serve.ts`: the identity, decided once at start.
  The token page (`token-manager-props.ts`, `issueAccessToken`) stores the requested write access; the switch is a gate
  at use time, so stored grants are left alone and come back when the switch is on again.
- `ModuleContext` (`McpAccessContext`) is what `readSwitch` takes; every place above has one (stdio builds one from the
  command database's handle).
- Consent page: `ConsentForm` renders the target inside the app row as a muted `note`
  (`consent.returnsTo`); `OAuthConsentPage` takes only `searchParams`. `mcpAccessMessages` ships English only (test),
  so "every locale" means `en`. `ClassNames<Slot>` slots: keeping `note` avoids breaking apps that pass it.
