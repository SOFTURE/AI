---
change_id: testing-db-client-account-per-file
title: "testing/playwright: test database client and one account per test file (issue #412)"
status: archived
roadmap_item: null
issue: 412
branch: claude/project-thread-iyukpb
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12
---

## Intent

Close [issue #412](https://github.com/SOFTURE/AI/issues/412) (labels `enhancement`, `adoption`, `pkg: testing`): an
adopting app keeps two Playwright helpers in its own integration infrastructure that every app on SOFTURE packages
needs. When this change is done, `@softure-ai/testing/playwright` exports both:

1. `createTestDatabaseClient(url)`: a `pg` pool on the integration stack with `query` (an error names the
   statement), `countRows(table, where)` and `close`, usable with `withDatabase`.
2. `signInPerFile({ copy, email })`: the first `signIn` in a test file registers a unique account through the UI
   (`registerAccount`), later ones log in (`logIn`), so files run in parallel without sharing state.

A reviewer checks the new tests in `foundation/testing/tests/`, the README and the CHANGELOG `Unreleased` entry.

## Context

> Two Playwright helpers an adopting app keeps in its integration infrastructure:
>
> 1. **Test database client** (~70 lines): a `pg` pool on the integration stack, `query` that labels its error with
>    the statement, `countRows(table, where)`, and close. Proposed: `createTestDatabaseClient(url)` next to
>    `withDatabase` in `@softure-ai/testing/playwright`.
> 2. **One account per test file** (~120 lines): the first `signIn` in a file registers a unique account through the
>    UI (`registerAccount`), later ones log in (`logIn`), so files run in parallel without sharing state. Proposed:
>    `signInPerFile({ copy, email })` built on the existing `registerAccount` / `logIn`.
>
> `@softure-ai/testing` 0.1.4.

(issue #412, 2026-10-12)

`@softure-ai/testing` is 0.1.4 on master. Releases are batched by the coordinator, so this change bumps no version:
the CHANGELOG gets an `## Unreleased` section.

## Constraints

- Owns `foundation/testing/` (src, tests, README, CHANGELOG, package.json) and the lockfile entry it needs.
- An app that uses `@softure-ai/testing/playwright` without `pg` keeps working: `pg` stays optional.
- Existing exports keep their API and behaviour.
- Issue #402 (testing guards) waits on this change; it does not touch the Playwright entry.

## Notes

- Placement: unlinked (`roadmap_item: null`); autonomous mode works from issues, no active roadmap.
- Framing: skipped. The issue names both helpers, their behaviour and the API it wants.
- Archived 2026-10-12: `@softure-ai/testing/playwright` exports `createTestDatabaseClient` and `signInPerFile`.
