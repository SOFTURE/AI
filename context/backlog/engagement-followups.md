# Backlog: engagement follow-ups

Findings from the engagement roadmap that are not roadmap items yet. Entry format: WORKFLOW §3.

- [ ] 2026-10-03 waitlist (EN-5): no double opt-in, a sign-up counts at once. A confirmation step as an
  option needs a `confirmed_at` column, a signed link in the welcome mail and a rule that list mail and
  consent rows wait for the confirmation (MEDIUM) `modules/waitlist/README.md` §12
- [ ] 2026-10-03 waitlist (EN-5): unsubscribing through mailing's link stops list mail but does not record a
  consent withdrawal in `privacy.consents`, and signing up again does not lift the mailing suppression. Both
  need a mailing hook (on unsubscribe, on a new explicit consent) that the waitlist and privacy plug into, so
  the consent ledger matches what the recipient actually receives (HIGH) `modules/waitlist/README.md` §12
