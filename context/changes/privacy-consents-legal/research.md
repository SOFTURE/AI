# Research: privacy-consents-legal

Sources: `modules/privacy` (EN-7), `modules/auth/src/server/register.ts` and `options.ts`
(`onRegistered`), `modules/mailing` (migration, health, `getRecipientKey`), `modules/mcp-access`
(a module with a table and a contributor), `foundation/db` (migrator, introspection),
`docs/01-module-assessment.md` row 8, the waitlist entry (EN-5). FIRE_TRACKER is outside this
session's scope; the roadmap baseline says FIRE checks the consent checkbox and stores nothing.

## 1. What exists

- auth checks `requireConsent` at registration and calls `onRegistered({ user, consent: { acceptedAt } | null }, txCtx)`
  inside the account's transaction: a hook that throws rolls the account back. Auth itself stores
  no consent, so there is nothing to migrate into a ledger (unknown 3 answered: no migration).
- privacy (EN-7) has no schema. A module becomes part of the export and the deletion by passing
  `privacy` to `defineModule`; privacy can be its own contributor. It depends on auth, so its
  deletion runs before auth's and a `user_id` FK to `auth.users` holds.
- The migrator runs each module's files with `search_path` set to its schema; introspection covers
  triggers and functions, so a trigger is part of the reviewed schema.
- mailing keys suppressions by the SHA-256 of the normalised address (no address in the table).

## 2. Unknowns from the roadmap

1. **Withdrawal: new row or update?** New row. Consent law asks for evidence of when consent was
   given and withdrawn; an update erases the first fact. The table is append-only, enforced by a
   `BEFORE UPDATE` trigger (an invariant in the database, not only in code). The current state of a
   purpose is its latest row (`recorded_at`, then an identity column for ties).
2. **How the app declares document versions.** `privacy({ documents: [{ id, version }] })`. A
   consent names a document by id; privacy stamps the configured version, so a call site never
   carries a version string that can drift from the published text. Reading a consent reports
   `isCurrentVersion` against the configuration; the legal page reads the same version through
   `getLegalDocument`.
3. **Does auth's stored consent migrate?** Auth stores none (1). `recordRegistrationConsent()` is a
   ready `onRegistered` hook that records one row per declared document (purpose = document id,
   source `registration`) at the moment the account is created, in its transaction.

## 3. Subjects

Registration knows an account; a waitlist sign-up knows only an email. A row therefore has exactly
one of `user_id` (FK to `auth.users`) or `email_key` (base64url SHA-256 of the trimmed, lowercased
address, the same derivation as mailing's recipient key), checked with `num_nonnulls(...) = 1`.
The export and the deletion of a user cover both: rows of the account and rows of its email.

## 4. Legal shell

The components are server-renderable (no state), take content as props (sections with an id, a
title and React content; a change history) and read their labels (table of contents, version,
effective date, change history, footer navigation) from privacy's messages. Dates are ISO
`YYYY-MM-DD` strings formatted in the app's locale in UTC, so the server's zone cannot shift them.
