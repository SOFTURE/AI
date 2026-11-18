# Plan: connections-user-oauth

## Approach
A new entry `src/user-oauth/` (provider, state, client, secrets, index) on the module's token client and crypto,
the fake provider extended for the user flow, tests in `tests/user-oauth.test.ts`, docs and a minor release.

## Decisions (auto)
- A stateless entry, not tables keyed by user: what a user's grant is for (a folder, a repository) is the app's data,
  so the app keeps the grant beside it; the module's admin table, page and privacy contributor stay the app's own.
- Client credentials are passed per call, not named by env: the app already reads them with its own settings.
- The state hash is lowercase hex sha256 (what apps index on); the verifier and state are 32 random bytes, base64url.
- Revocation styles: `rfc7009` and `bearer` (Dropbox); none means `revokeUserGrant` answers false.
- Failure codes `connections.user_oauth_{rejected,reconnect_required,unavailable}` with `status` and `oauthError`;
  `reconnect_required` only for a refresh answering `invalid_grant`.
- `fields` on the token answer: other top-level strings, bounded, nothing named like a token, secret or password.
- No refresh lease: stateless; documented as a limitation for rotating providers refreshed from several workers.
- Minor bump (0.7.0): a new public entry.

## Phases
1. Entry, fake, tests (test-after). Done when typecheck, lint and the connections tests are green.
2. README, CHANGELOG, `softure.workers`, version bump.

## Progress
- [x] Phase 1: `npx vitest run modules/connections` 22 files green (user-oauth 19 tests); `npx tsc --noEmit` and
      `npx eslint modules/connections --max-warnings 0` clean.
- [x] Phase 2: README section 4 "Users' own OAuth grants", limitation, CHANGELOG 0.7.0, `./user-oauth` export listed
      Workers-safe (`tests/repo/workers-entries.test.ts` green), versions 0.7.0 in package.json, module.json, manifest.
