# Backlog: identity follow-ups

Findings from the identity roadmap that are not roadmap items yet. Entry format: WORKFLOW §3.

- [ ] 2026-10-02 feature-switches (ID-6): auth reads `auth.registration_closed` from its own option and
  `SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED`, not through `@softure-ai/feature-switches`, because
  feature-switches depends on auth (the panel's role check) and auth cannot import it back. Wiring it
  needs a switch-reader contract in `@softure-ai/core` (feature-switches provides it, auth asks it
  with a fallback to its option), an async `isRegistrationClosed(ctx)` in auth, and a report of
  manifest switches the app did not define. Must land before ID-9 adopts switches in FIRE_TRACKER,
  whose registration switch is flipped from its panel (HIGH) `modules/auth/src/server/switches.ts`
