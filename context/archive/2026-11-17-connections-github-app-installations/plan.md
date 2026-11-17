# Plan: connections-github-app-installations

## Approach
A new entry `src/github-app/` (jwt, client, index) on `requestJson`, a fake GitHub App in `src/testing/`, tests in
`tests/github-app.test.ts`, docs and a minor release.

## Decisions (auto)
- Separate entry, stateless, rather than a provider kind: an installation per end user has no place in the admin
  table, and nothing in it is secret.
- Errors `connections.github_app_*` with `status` and `retryAfterSeconds`; `not_found` by status 404 whatever core's
  code, `rejected` for 401 and 403 (suspended, bad JWT), and for an OAuth error from the code exchange.
- The key cache is per PEM and per process (an isolate on Workers); the JWT is minted per call (cheap) so no clock
  skew accumulates.
- The fake identifies a user token through `resolveUserId`, so it composes with whatever fakes the sign-in.
- Minor bump (0.5.0): a new public entry.

## Phases
1. JWT, client, fake, tests (test-after). Done when typecheck, lint and the connections tests are green.
2. README, CHANGELOG, `softure.workers`, version bump.

## Progress
- [x] Phase 1: `npx vitest run modules/connections/tests/github-app.test.ts` 8/8; JWT verified with Node's `createVerify`
      for PKCS#1, PKCS#8 and an escaped one-line key.
- [x] Phase 2: README section and testing example, CHANGELOG 0.5.0, `./github-app` export listed Workers-safe.
