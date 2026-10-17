---
change_id: waitlist-consent-gate-557
---

# Research: waitlist-consent-gate-557

Sources: `modules/waitlist/src/server/signups.ts` (`joinWaitlist`, `checkScopes`), `src/next/actions.ts`,
`src/options.ts` (`scopeSchema.required`), `src/ui/waitlist-form.tsx`, `src/next/waitlist.tsx`, README, tests
`signups.test.ts`, `next-join.test.tsx`.

- `scopeSchema` has `required: boolean` ("the form cannot be sent without it"); README documents it.
- `WaitlistForm` renders each scope as a `Checkbox` with `required={scope.required}` and `label: ReactNode`;
  `<Waitlist consentLabels>` replaces a config label with markup. The issue's second ask is already met.
- `joinWaitlist` order today: client rate limit (`waitlist` bucket) → `normalizeEmail` → `checkScopes`
  (`form_invalid`, then `consent_required`) → channel check → per-address rate limit (`waitlist-email`) →
  transaction (suppression check, write) → the action sends mail after the response only on success.
- So a missing required consent already costs one client attempt and writes, looks up and mails nothing. The only
  thing that runs on the address first is `normalizeEmail` (pure), and it decides the answer when the address is also
  malformed (`email_invalid` instead of `consent_required`).
- `joinWaitlistAction` maps `consent_required` to `field: "consent"`; nothing else in the action reads the address
  before `joinWaitlist` except echoing it back for the form.
- Tests: `signups.test.ts` covers each refusal with "stores nothing" and the per-client and per-address limits; no
  test pins the order between a missing consent and a malformed address, nor that a refused consent spends a client
  attempt but no per-address attempt.
