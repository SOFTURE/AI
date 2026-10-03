---
change_id: privacy-consents-legal
title: "Privacy consents ledger and legal document shell"
status: archived
roadmap_item: EN-8
branch: claude/en-8-privacy-consents-legal-qbtwcv
created: 2026-10-03
updated: 2026-10-03
archived_at: 2026-10-03
---

## Intent

`@softure-ai/privacy` keeps evidence of consent: `privacy.consents` records who agreed to what, when,
from where and against which version of which legal document, append-only, with withdrawals as new
rows. Modules and the app record and query consent through `/server`; auth registration records
the acceptance of the app's legal documents through a ready `onRegistered` hook, and the waitlist
(EN-5) records its scopes for an email address without an account. `LegalDocument`, `LegalSection`
and `LegalFooter` in `/ui` render legal pages from content the app provides (table of contents,
version, effective date, change history).

Input: [`backlog-input.md`](backlog-input.md) (roadmap item EN-8).

## Scope

- Migration `privacy/0001_create_consents.sql`, Drizzle view, health check, the module's own
  privacy contributor (export and deletion of the user's consents).
- `privacy({ documents: [{ id, version }] })`: the app declares its legal documents and their
  current versions in one place.
- `/server`: `recordConsent`, `getConsent`, `hasConsent`, `listConsents`, `getLegalDocument(s)`,
  `recordRegistrationConsent()` (auth `onRegistered` hook).
- `/ui`: `LegalDocument`, `LegalSection`, `LegalFooter`; copy for their labels in `en` and `pl`.
- Example app: documents in the config, the hook in auth, `/legal/terms` and `/legal/privacy`
  pages, the footer in the layout, `e2e/privacy-consents.spec.ts`, the ledger and health lists.

## Out of scope

- A consent management page (withdrawing a scope from the account page); EN-5 and the mailing
  unsubscribe cover the newsletter case.
- Re-acceptance flows when a document version changes (the API reports `isCurrentVersion`, the app
  decides what to do).
- Legal text itself: content stays with the app.
