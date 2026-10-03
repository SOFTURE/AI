---
change_id: privacy-consents-legal
title: "Consent records and legal document shell"
status: backlog
roadmap_item: EN-8
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`privacy.consents` records every consent with subject, purpose, document version and timestamp; an API to record and query consent used by auth registration and the waitlist; `LegalDocument`, `LegalSection` and `LegalFooter` components (table of contents, change history) that render app-provided content.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **EN-8** (roadmap `engagement`, main since 2026-10-03):

> ### EN-8: Consent records and legal document shell
> - **Change ID:** `privacy-consents-legal`
> - **Status:** ready
> - **Outcome:** `privacy.consents` records every consent with subject, purpose, document version and timestamp; an API to record and query consent used by auth registration and the waitlist; `LegalDocument`, `LegalSection` and `LegalFooter` components (table of contents, change history) that render app-provided content.
> - **Prerequisites:** EN-7.
> - **Unknowns:** Consent withdrawal semantics (new row vs. update); how document versions are declared by the app; whether auth's stored consent from identity migrates into this ledger.
> - **Risk:** medium. Compliance evidence must be complete.
> - **Baseline:** FIRE checks consent at registration but does not store it. After: registration and waitlist sign-up both produce consent rows (unit + e2e), legal pages render from app content.
> - **PRD refs:** FR-21.

Reference material: [`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `modules/privacy/` consents and legal components, `modules/privacy/migrations/`, `examples/next-app/e2e/privacy-consents.spec.ts`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
