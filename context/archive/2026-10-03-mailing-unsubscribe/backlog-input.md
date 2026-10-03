---
change_id: mailing-unsubscribe
title: "Signed one-click unsubscribe and suppressions"
status: backlog
roadmap_item: EN-2
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

Every non-transactional mail carries an HMAC-signed unsubscribe link and RFC 8058 `List-Unsubscribe` / `List-Unsubscribe-Post` headers; a one-click POST endpoint and an unsubscribe page (Next adapter) record the opt-out in `mailing.suppressions`; `sendMail()` refuses suppressed recipients for non-transactional kinds.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **EN-2** (roadmap `engagement`, main since 2026-10-03):

> ### EN-2: Signed one-click unsubscribe and suppressions
> - **Change ID:** `mailing-unsubscribe`
> - **Status:** ready
> - **Outcome:** Every non-transactional mail carries an HMAC-signed unsubscribe link and RFC 8058 `List-Unsubscribe` / `List-Unsubscribe-Post` headers; a one-click POST endpoint and an unsubscribe page (Next adapter) record the opt-out in `mailing.suppressions`; `sendMail()` refuses suppressed recipients for non-transactional kinds.
> - **Prerequisites:** EN-1.
> - **Unknowns:** Secret rotation for the HMAC key (accept old and new during rotation?); whether suppressions are per mail kind or global; footer rendering in HTML vs. plain text.
> - **Risk:** medium. A broken link or header hurts deliverability and compliance.
> - **Baseline:** FIRE: signed links and headers exist, suppression is a column on its waitlist table. After: suppression works for any mail kind, covered by unit tests and an e2e one-click scenario.
> - **PRD refs:** FR-16, NFR-5.

Reference material: [`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `modules/mailing/` unsubscribe code, `modules/mailing/migrations/` (suppressions), `examples/next-app/e2e/mailing-unsubscribe.spec.ts`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
