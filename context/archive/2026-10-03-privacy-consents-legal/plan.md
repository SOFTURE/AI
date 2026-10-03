# Plan: privacy-consents-legal

Input: change.md, research.md. Complexity: medium (2 phases). Risk: medium (compliance evidence).

## Goal

- `privacy.consents` (migration 0001): `id` identity, `user_id` (FK `auth.users`) xor `email_key`,
  `purpose`, `granted`, `document_id` + `document_version` (both or neither), `source`,
  `recorded_at`; append-only through a `BEFORE UPDATE` trigger; indexes by subject and purpose.
- Options: `documents: [{ id, version }]` (kebab-case ids, unique).
- `/server`: `recordConsent(ctx, { subject, purpose, granted, document?, source })` →
  `Ok<ConsentRecord> | Err<privacy.consent_invalid | privacy.document_unknown>`;
  `getConsent`, `hasConsent` (latest row granted and for the current version), `listConsents`;
  `getLegalDocuments`, `getLegalDocument`; `recordRegistrationConsent({ documents? })`.
- The module contributes: export `{ consents: [...] }`, deletion of the account's and its email's rows.
- Health check `privacy` (table answers).
- `/ui`: `LegalDocument`, `LegalSection`, `LegalFooter`; messages `legal.*` in en and pl.
- Example app: documents, the hook, `/legal/terms`, `/legal/privacy`, footer, e2e.

**Out of scope:** see change.md.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Withdrawal | a new row with `granted = false` | evidence of both facts | research 2.1 |
| Immutability | trigger refusing `UPDATE`; `DELETE` stays for erasure | invariant in the database | research 2.1 |
| Versions | declared once in `privacy({ documents })`, stamped by privacy | no drifting version strings | research 2.2 |
| Registration | `onRegistered` hook factory, rows per document | same transaction as the account | research 2.3 |
| Email subjects | SHA-256 key, not the address | minimal data, matches mailing | research 3 |
| Erasure | consents deleted with the account | nothing left to prove once data is gone | research 3 |

Rejected: an `UPDATE`-able current-state table (loses history); a `consent_versions` table
(versions are code, they ship with the text); purposes declared in privacy's config (the waitlist
owns its scopes, EN-5).

## Phase 1: Ledger, API, contributor, legal components

**Discipline:** TDD.

- `migrations/0001_create_consents.sql`, `src/schema.ts`, options, contract codes, `src/server/{consents,legal-documents,registration-consent,privacy,health}.ts`, manifest and `module.json`.
- `src/ui/legal-document.tsx`, `legal-footer.tsx`; messages.
- Tests on PGlite: record/get/has/list, withdrawal, versions and `isCurrentVersion`, invalid input,
  append-only trigger, subject check, registration hook (on, off, misconfigured), contributor
  export and deletion (account and email rows, other users untouched), health, module options,
  component rendering, messages.

## Phase 2: Example app, e2e, docs

- Example config, legal pages, footer, `e2e/privacy-consents.spec.ts`; `migrations.spec.ts`,
  `ops.spec.ts` and `scripts/container.mjs` list the new migration and health check.
- README sections 1, 3, 4, 5, 8, 9, 11, 12; docs where the standard lists modules' tables.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Ledger, API, contributor, legal components

#### Automated
- [x] 1.1 Consent, registration hook, contributor and health tests pass on PGlite — 594e504
- [x] 1.2 Component, messages and module tests pass; `module.json` equals the manifest — 594e504
- [x] 1.3 Gates green (typecheck, lint, test) — 594e504

### Phase 2: Example app, e2e, docs

#### Automated
- [x] 2.1 Gates green (typecheck, lint, test, build) — 43441e1
- [x] 2.2 `npm run e2e` passes, including `e2e/privacy-consents.spec.ts` — 43441e1

#### Manual
- [x] 2.3 Impl review recorded in `reviews/impl-review.md` — 43441e1
