---
change_id: waitlist-consent-gate-557
status: archived
---

# Plan: waitlist consent checked before the address (issue #557)

Input: change.md, research.md. Complexity: small (one reorder, tests, docs).

## Phase 1: consent gate first (TDD)

Files: `modules/waitlist/src/server/signups.ts`, `modules/waitlist/tests/consent-gate-557.test.ts`.

1. Tests first:
   - a form without the required scope and with a malformed address answers `waitlist.consent_required`;
   - a refused consent spends one client attempt (client bucket limit 1: the next valid join is
     `security.rate_limited`) and no per-address attempt (per-address limit 1: the same address then joins from
     another client), and stores nothing and sends no mail;
   - an app without a required scope keeps answering an empty form with `consent_required` and a malformed address
     with `email_invalid`.
2. Move `checkScopes` in front of `normalizeEmail` in `joinWaitlist`; update its doc comment.

## Phase 2: docs

`modules/waitlist/README.md` (the required scope is the gate, with its order), `CHANGELOG.md` `## Unreleased` with the
migration for an app that kept its own action.

## Progress

- [x] Phase 1: consent gate first (3 tests written first; the order test was red before the change; all 181 waitlist tests pass)
- [x] Phase 2: docs (README scopes row, CHANGELOG `## Unreleased` with the migration)
