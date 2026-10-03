---
change_id: privacy-registry
title: "Privacy module: export and deletion contributors from modules and the app, a JSON export endpoint and self-service account deletion"
status: in_progress
roadmap_item: EN-7
branch: claude/en-7-privacy-registry-d44kyj
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

An app that lists `privacy()` in `softure.config.ts` gives every signed-in user two self-service
GDPR rights without writing them: a JSON download of everything the app holds about them, and
account deletion. Neither lists tables by hand. Every enabled module that holds user data
contributes `exportUserData(userId)` and `deleteUserData(userId)` through the contract core already
defines (`PrivacyContributor`, guarded by the manifest's `privacy` flags), and the app adds its own
contributors in `privacy({ contributors })`. Deletion runs every contributor in one transaction, in
an order that respects foreign keys (the app first, then modules from dependents to dependencies,
auth last), so a refusal or a failure leaves nothing half deleted. A contributor may refuse
(legal retention); the user sees that the account could not be deleted, and nothing is.

The released identity modules register theirs: auth (account, roles, sessions, pending reset) and
feature-switches (the switches the user last set; deletion clears `updated_by`).

## Context

Taken from the roadmap entry, kept as [`backlog-input.md`](backlog-input.md). Roadmap:
[`roadmap.md`](../../foundation/roadmap.md) (roadmap `engagement`), item **EN-7**. Outcome,
unknowns, risk and baseline are quoted there.

## Constraints

- Exclusively owns: `modules/privacy/` (registry, export, deletion), contributor registrations in
  `modules/auth/` and `modules/feature-switches/`, `examples/next-app/e2e/privacy-export-delete.spec.ts`
  and the example's privacy pages.
- Shared hot file `examples/next-app/softure.config.ts`: add only this module's entry (and its
  buckets).
- No migration: EN-8 adds `privacy.consents`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` dictionaries.
- No release, tag or publish by the agent; the owner tags releases. FIRE_TRACKER is read-only.

## Notes
