---
change_id: mailing-consent-sync
title: "Unsubscribe as consent withdrawal"
status: backlog
roadmap_item: FU-3
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A mailing hook on unsubscribe and on a new explicit consent: an unsubscribe through mailing's link records a withdrawal in `privacy.consents`, and a new explicit sign-up lifts the mailing suppression, so the consent ledger matches what the recipient receives.

## Context

From [`roadmap-followups.md`](../../../foundation/roadmaps/roadmap-followups.md), item **FU-3** (queued roadmap `followups`):

> ### FU-3: Unsubscribe as consent withdrawal
> - **Change ID:** `mailing-consent-sync`
> - **Status:** proposed
> - **Outcome:** A mailing hook on unsubscribe and on a new explicit consent: an unsubscribe through mailing's link records a withdrawal in `privacy.consents`, and a new explicit sign-up lifts the mailing suppression, so the consent ledger matches what the recipient receives.
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** Which module owns the mapping from a mail kind to a consent purpose; whether lifting a suppression needs a fresh consent row in the same transaction.
> - **Risk:** HIGH: today the ledger can show a granted consent for a recipient who unsubscribed.
> - **Baseline:** engagement EN-5 `waitlist`: unsubscribing stops list mail but records no withdrawal, and signing up again does not lift the suppression (README §12). After: the gap is closed and covered by unit and e2e tests.
> - **PRD refs:** FR-16, FR-18, FR-21.
> - **Source:** `modules/waitlist/README.md` §12, `modules/mailing/README.md`

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard).

## Constraints

- Exclusively owns: `modules/mailing/` hooks, `modules/waitlist/` and `modules/privacy/` wiring.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
