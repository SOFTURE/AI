---
change_id: privacy-document-history-copy-script
title: "privacy: legal document history with version-at-date, and a copy-account ops script (issue #325)"
status: archived
roadmap_item: null
issue: 325
branch: claude/project-thread-ez8yk5
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Two gaps an adopting app filed ([#325](https://github.com/SOFTURE/AI/issues/325)):

1. **Document history.** `privacy({ documents })` declares `{ id, version }` only. Apps keep each document's change
   history themselves, guard with a test that `version` equals the newest history date, and write their own
   "version in force at a date" helper for backdated consents. After this change a document may declare
   `history: [{ date, summary, version? }]`; its version is derived from the newest entry (a declared `version` must
   agree), `getDocumentVersionAt(config, id, at)` answers the version in force on a day or at an instant,
   `importConsent` stamps a backdated consent with that version, and `LegalDocument` renders the version line and
   the change history from the declaration (`document={getLegalDocument(config, id)}`).
2. **Copy-account command.** `copyAccount` (0.1.9) is a library; every app wraps it in the same dry-run command.
   After this change `@softure-ai/privacy/scripts` ships `createCopyAccountScript(options)`, a safe ops script
   (`@softure-ai/ops/scripts`) that copies one account (`--user` or `--email`) from the database at `--from` into the
   app's database, dry run by default, `--commit` writes, report before and after.

A reviewer checks `modules/privacy/src/options.ts`, `src/server/legal-documents.ts`, `src/server/consents.ts`,
`src/ui/legal-document.tsx`, `src/scripts/`, the tests, README sections on legal documents and copying an account,
the CHANGELOG and the version (privacy 0.1.11, unreleased, shared with #313).

## Context

- `toCalendarDay(instant, timeZone)` exists in `@softure-ai/core`; the config carries `timezone`.
- auth, billing and waitlist ship ops scripts as `create*Script` factories in a `/scripts` entry, with
  `@softure-ai/ops` as an optional peer.
- #312 (open) moves `formatLegalDate` onto core's `formatCalendarDay`; this change only calls `formatLegalDate`.
- #328 (open) adds `runOpsMain`; the script works with `runOpsScript` and with `runOpsMain` alike.

## Constraints

- Existing `{ id, version }` declarations parse and behave as before.
- The config stays plain data (summaries are strings).
- Nothing on the consent table changes.

## Notes

- `research` skipped: the issue names the gaps; the code read (options schema, legal documents, consents,
  LegalDocument, copyAccount, ops scripts and auth's scripts) is recorded in the plan.
- `frame` skipped: both gaps are reported boilerplate in an adopting app, not in doubt.
