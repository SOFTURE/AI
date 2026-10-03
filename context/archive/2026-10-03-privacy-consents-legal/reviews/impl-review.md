# Implementation review: privacy-consents-legal

Reviewed: commits of phases 1 and 2 against plan.md (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 2 warning, 1 suggestion.
Evidence: gates green (typecheck, lint with the language gate, unit tests, build); `npm run e2e`
on PostgreSQL 16: 53 passed, including the three tests of `e2e/privacy-consents.spec.ts` and the
updated ledger, health and export expectations.

## Drift from plan

- `getEmailKey` is exported from `/server` so the waitlist (EN-5) and operator scripts can find an
  address's rows without storing it.
- `formatLegalDate` is exported from `/ui`; apps that print a document's date elsewhere use it.
- `e2e/privacy-export-delete.spec.ts` (EN-7) now expects the `privacy` part of the export, and
  `scripts/container.mjs` the `privacy` health check: privacy became a contributor with a table.

## Findings

### W1 [WARNING] An app role without sequence rights
**Where:** `migrations/0001_create_consents.sql`
**Problem:** the ops recipe grants the app role table and sequence rights by default privileges; a
`serial` column would need the sequence grant on databases set up by hand.
**Decision:** Kept - the id is `GENERATED ALWAYS AS IDENTITY`; measured on PostgreSQL 16 that a
role with only `INSERT` on the table inserts rows. The container job of CI covers the recipe.

### W2 [WARNING] Reads keep subjects apart
**Where:** `getConsent`, `hasConsent`
**Problem:** a waitlist consent given by email before registering is not seen by
`hasConsent({ userId })`.
**Decision:** Kept as designed and documented in the README: a read answers for the subject it is
asked about; the export and the deletion cover both subjects of an account.

### S1 [SUGGESTION] Fixed anchor ids in `LegalDocument`
**Decision:** Kept - the table of contents and the change history use fixed ids, so one document
per page; legal pages hold one document each.

## Security checklist

- Consents are recorded only through server functions; nothing takes a subject from a request
  in this module (the registration hook gets the new account's id from auth).
- The table stores no email address (SHA-256 key only), and the export omits the key.
- Evidence cannot be rewritten: a trigger refuses `UPDATE` for every role, including the app's.
- Erasure removes the account's and its email's rows in the deletion transaction; the schema scan
  test lists `privacy.consents.user_id` before and nothing after.
