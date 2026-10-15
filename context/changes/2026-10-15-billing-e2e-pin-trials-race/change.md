---
change_id: billing-e2e-pin-trials-race
title: "The billing e2e pin-trials case no longer races other specs on the shared database (issue #505)"
status: archived
roadmap_item: null
issue: 505
branch: claude/project-thread-souz05
created: 2026-10-15
updated: 2026-10-15
archived_at: 2026-10-15
---

## Intent

Close [issue #505](https://github.com/SOFTURE/AI/issues/505). The `pin-trials` case of
`examples/next-app/e2e/billing-entitlements.spec.ts` fails now and then with
`entitlements_user_id_fkey` (23503). It must pass on every run without retries, skips or a looser assertion.

## Context

Issue #505 (labels `bug`, `pkg: billing`). Seen on PR #485 and PR #497, both green after one re-run.
The e2e suite runs `fullyParallel` against one Postgres database; the `pin-trials` script works on every
account in that database, not only the test's own.

## Constraints

- Test harness only (`examples/next-app/`); no package source change, so no release.
- No retry, skip, quarantine or weaker assertion.
- No change in any adopting app's repository.

## Notes

- Placement: unlinked one-off from the issue queue (`autonomy.source: issues`), `roadmap_item: null`.
- Framing: skipped. The failure and its cause are concrete (research.md confirms the race).
- Archived 2026-10-15: the pin-trials e2e case runs alone in the one-worker `serial` project, so other specs no longer delete or create accounts while the script reads the whole database.
