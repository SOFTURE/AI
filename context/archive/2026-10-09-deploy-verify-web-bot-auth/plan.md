# Plan: deploy-verify-web-bot-auth

Input: change.md (research and framing skipped, reasons in change.md). Complexity: small (one phase).

## Goal

A `verify` route takes `webBotAuth: { "keyEnv": "...", "agent": "..." }` and sends every request of the route
(its forEach source included) with `Signature-Agent`, `Signature-Input` and `Signature` computed for that request.

## Key decisions

- **D1 Where the signer lives (the issue's open question).** `@softure-ai/deploy` does not depend on
  `@softure-ai/agent-ready`: agent-ready already has deploy as a devDependency (its verify test), so the reverse
  edge makes a workspace cycle and breaks the dependency-ordered build. A shared package for ~40 lines would bump
  core and agent-ready for no behaviour change. Deploy gets its own request signer on `node:crypto`
  (`src/verify/web-bot-auth.ts`), the same profile as agent-ready's: components `@authority` and
  `signature-agent;key="sig1"`, `alg="ed25519"`, `keyid` the RFC 7638 thumbprint, a 64-byte nonce, tag
  `web-bot-auth`, five minutes of validity. The oracle in its tests is Cloudflare's reference library
  `web-bot-auth` (a devDependency, already in the lockfile through agent-ready), not our own signature base.
- **D2 The key.** `keyEnv` (default `WEB_BOT_AUTH_PRIVATE_KEY`, agent-ready's default) names a variable holding the
  Ed25519 seed as base64url (the JWK `d`, what `agent-ready web-bot-auth key` prints). Unset or empty: the route
  fails one `request` check `<NAME> is not set`; malformed: `<NAME> is not a base64url Ed25519 seed (32 bytes)`.
  Nothing is sent in either case. The value is never printed.
- **D3 The agent.** `agent` (an http(s) origin) is the `Signature-Agent`, where the receiver finds the key
  directory; default the verified URL's origin, the app signing as itself.
- **D4 Per request.** The signature covers each request's own `@authority`, so forEach rows and their source are
  signed one by one. The route's `requestHeaders` cannot also set `signature`, `signature-input` or
  `signature-agent` (schema refine).
- **D5 Reach.** The CLI reads `process.env`; `runVerify` takes `env` for tests and callers. Passing the key into
  `deploy-app.yml`'s verify job is issue #357 (that job has no environment and no app secrets today).
- **D6 Docs and version.** 0.1.8 CHANGELOG line, README verify section, JSON schema regenerated.

## Phase 1: signer, schema, runner

- [x] Tests first: the signature verifies with the reference library for the request's own URL and fails for
  another; the schema accepts `webBotAuth` and refuses a conflicting request header; runVerify sends signed
  requests (forEach included) and fails a route naming a missing or malformed variable without a request.
- [x] D1-D4 in `web-bot-auth.ts`, `schema.ts`, `run-checks.ts`, `verify-command.ts`.
- [x] D5, D6; gates: typecheck, lint, deploy and repo tests, build.

## Progress

- 2026-10-09: plan written.
- 2026-10-09: phase 1 done; the signer, schema and runner tests verify with the reference library.
