---
change_id: pwa-device-data-874
verdict: approved
---

# Implementation review

Reviewed the branch diff against plan.md and the acceptance of #874.

- `clearDeviceData`: every part is started inside an async wrapper and settled with `Promise.allSettled`, so a part
  that throws synchronously (a blocked `localStorage`) is a failed part and the rest still runs (test "goes on past
  failed parts"). Part names match the plan; duplicates across registrations are cleared once.
- Missing APIs: injected `null` and missing globals are skipped; a global whose getter throws reads as missing. The
  `clear-pages` message goes out only with a controller.
- IndexedDB: `blocked` rejects instead of waiting; emptying a store of a missing database aborts the upgrade and
  leaves no database behind; a missing store is skipped; the connection is closed in `finally` (tests).
- `LogoutForm`: without JavaScript it is the plain form; with `beforeSignOut` the first submit is prevented, the
  button shows busy, and once `beforeSignOut` settles the form is submitted again with its button as the submitter
  (after the re-render, so the button is enabled). A failure is logged by `errorLogLabel` only; the action still runs.
  A later sign-out that did not leave the page runs `beforeSignOut` again.
- `LogoutButton` keeps its props and markup; its existing test passes. The messages passed to the client are plain
  strings.
- Docs: pwa README §1, §10 (API and recipe), §11 (GDPR), §12; auth README §4 and §10; both CHANGELOGs under
  `## Unreleased`. No version bump.
- Gates: typecheck, ESLint and the language gate green; `npm test` green.

Verdict: approved.
