# @softure-ai/waitlist

**Status:** wave 2 · not implemented · depends on: core, db, ui, security, mailing · optional: privacy

Waitlist signup (unique on `lower(trim(email))`, consent scope widened on a repeat signup,
unsubscribe token), a welcome mail in the background (`after()`), and a standalone `<WaitlistForm/>`.

**Tables:** `waitlist.signups`. Consent scopes and form placements come from configuration,
not from hard-coded CHECK constraints.

**Source in FIRE_TRACKER:** `src/db/waitlist.ts`, `src/app/actions/{do-waitlist,waitlist,waitlist-contract}.ts`,
`src/lib/{waitlist-consent,waitlist-placement,welcome-mail}.ts`, `src/components/consent-checkbox.tsx`,
and the form from the domain-specific `calculator-lista.tsx`.
