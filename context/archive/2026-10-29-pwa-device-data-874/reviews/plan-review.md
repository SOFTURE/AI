---
change_id: pwa-device-data-874
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (e1852f4).

- Acceptance of #874: every part cleared even when another fails, synchronous throws counted (Phase 1, `allSettled`
  over wrapped starts); the four part kinds; missing APIs skipped; failed names returned; registry usable by modules;
  `beforeSignOut` awaited, logged by kind, sign-out goes on (Phase 2); GDPR note (Phase 3). Each has a test.
- Risk: IndexedDB `open` creates a missing database. The plan aborts the upgrade; the test fake checks that no
  database is left.
- Risk: React's form action and a held submit. `preventDefault` then `requestSubmit` keeps the action on its normal
  path; the test asserts the order (beforeSignOut settles before the action is called) and that a rejection still
  submits.
- Risk: #873 edits the same pwa index and README. Additive lines only; conflicts resolved when master is merged in.
- `LogoutButton` keeps its props and its no-JavaScript behaviour; its existing test stays as is.

Verdict: approved, no changes.
