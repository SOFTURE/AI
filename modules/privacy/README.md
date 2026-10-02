# @softure-ai/privacy

**Status:** wave 2 · not implemented · depends on: core, db, ui, auth

- **GDPR contributor registry:** every module and the application register `export(userId)` / `delete(userId)`.
  The module provides an export endpoint (JSON) and self-service account deletion.
- **Consent ledger** (`privacy.consents`: who, to what, when, document version).
- **Legal page shell:** `LegalDocument` (table of contents, change history), sections, footer.
  The application provides the content (MDX/JSX).

**Source in FIRE_TRACKER:** `src/db/{account-export,account-deletion}.ts`, `src/app/api/moje-dane/`,
`scripts/delete-empty-account.mts`, `src/components/{legal-document,legal-section,legal-footer}.tsx`,
`src/app/legal-text.ts`, `src/lib/owner.ts`.

**Improvements:** the source lists tables by hand, deletes accounts only from a CLI and does not record consent.
