---
change_id: mcp-access-write-switch-consent-host-904-906
status: in_progress
---

# Plan: write kill switch and the redirect host row (issues #904, #906)

Input: change.md, research.md. Complexity: small (one new server file, call sites, consent form, docs).

## Phase 1: the writes switch (#904, TDD)

Files: `modules/mcp-access/src/server/writes-switch.ts` (new), `src/index.ts` (constant, manifest), `module.json`,
`src/server/endpoint.ts`, `src/server/oauth-http.ts`, `src/next/oauth-page.tsx`, `src/stdio/serve.ts`,
`src/server/index.ts`, `tests/writes-switch-904.test.ts` (new).

- `WRITES_ENABLED_SWITCH = "mcp-access.writes_enabled"` in the manifest's `switches` and `module.json`.
- `isWritingEnabled(ctx)`: false without `allowWrites` (no read); otherwise the switch's value, `true` when undeclared;
  a thrown read logs once by name and reads as false.
- Endpoint: read once per request; challenge scopes and the token's scopes follow it.
- OAuth: `AuthorizationRequest` gains `isWriteOffered` (requested or default scope, and writing enabled); the default
  scope follows the switch; the decision and the consent page use `isWriteOffered`.
- Stdio: the identity's `canWrite` also needs the switch, read at start.
- Tests: switch off → no write tools for a write token, challenge `mcp:read`, consent request not offering writes and a
  ticked decision granting read only; switch on and undeclared → today's behaviour; a throwing reader → read only;
  `allowWrites: false` never reads the switch; stdio identity.

## Phase 2: the redirect host row (#906)

Files: `src/ui/consent-form.tsx`, `src/messages/en.ts`, `src/next/oauth-page.tsx`, `tests/token-manager.test.tsx`.

- A row of its own: `dt` `consent.redirectLabel`, `dd` the target in a new `target` slot (monospace, foreground), and the
  hint `consent.redirectHint` in the `note` slot. The app row shows the client name alone. `consent.returnsTo` goes.
- `OAuthConsentPage` accepts `classNames` (and `unstyled`) and passes them to `ConsentForm` and `ConsentError`.
- Tests: the target in its own row for an https host and for a native scheme URI; not inside the app row.

## Phase 3: docs

README §1, §3, §7 (the switch, `failMode: "closed"` with `override: "towards-fail-mode"`), the consent page section;
`CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- Undeclared switch means writes on: today's behaviour, as the issue asks.
- A thrown switch read fails closed (read only), logged once by name: writes are the risky side.
- Stored token and grant write access is left as is; the switch gates use, not issue, so flipping it back restores
  writes without re-consent. The token page keeps showing configuration (out of the issues' scope).
- The OAuth token response's `scope` keeps the grant's scopes: it describes the grant; the endpoint enforces the switch.
- `consent.returnsTo` is removed (its only use was the note); the `note` slot stays, now styling the hint.
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: the writes switch
- [x] Phase 2: the redirect host row
- [x] Phase 3: docs
- [x] Implementation review: approved
