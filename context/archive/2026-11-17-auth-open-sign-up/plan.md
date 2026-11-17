# Plan: auth-open-sign-up

## Approach
One option on the shared allowlist shape, honoured by `isAllowedEmail`, plus a switch check before account creation
for open providers. Tests on the GitHub fake (the OpenID Connect path shares `isAllowedEmail` and `resolveOidcAccount`).

## Decisions (auto)
- Name `openSignUp` (reads as what it does; `allowAnyEmail` hides the registration gate).
- Closed registration answers a new code `auth.oidc_registration_closed` rather than reusing
  `auth.registration_closed`, because the login page shows only `auth.oidc_*` codes after a provider sign-in.
- `isRegistrationSwitchOn` split out of `isRegistrationClosed`, so a passwordless app with an open provider still
  creates accounts while the switch is off.
- Patch bump (0.2.17), as every 0.2.x feature so far.

## Phases
1. Option, allowlist, account creation, copy, fake, tests (test-after; the closed-registration test seen red without
   the check). Done when typecheck, lint and the auth tests are green.
2. README, CHANGELOG, version bump.

## Progress
- [x] Phase 1: `npx vitest run modules/auth/tests/oidc-github.test.ts modules/auth/tests/messages-before-oidc.test.tsx
      modules/auth/tests/oidc-flow.test.ts` 63/63; the closed-registration test fails with the check removed.
- [x] Phase 2: README "Open sign-up", CHANGELOG, `auth@0.2.17`.
