---
change_id: billing-guard-race-tests
title: "Billing guards and lock races are tested where they can fail"
status: archived
roadmap_item: FU-26
branch: claude/fu-26-billing-guard-race-tests-kvrgtv
created: 2026-10-04
updated: 2026-10-04
archived_at: 2026-10-04
---

## Intent

CI proves billing's guards and locks. `requireWriteAccess` and every billing server action are
unit-tested as an anonymous visitor, a member and an admin. The first-insert race of
`changeEntitlement` and two concurrent plan grants run on two Postgres connections, in an order that
is forced, so the tests fail when a lock is dropped. An e2e covers a paid period that ended. A
misspelt `adminRole` (not among `auth({ roles })`) fails at the first billing request and in the
readiness probe, with a message that names `billing({ adminRole })`.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-26).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-26** (roadmap `followups`):

> - **Outcome:** CI proves billing's guards and locks: `requireWriteAccess` and every billing server action are unit-tested as anonymous, member and admin; the first-insert race of `changeEntitlement` and two concurrent plan grants run on two Postgres connections; an e2e covers a paid period that ended; a misspelt `adminRole` (not among `auth({ roles })`) fails at setup instead of silently locking every admin out.
> - **Unknowns:** How a unit test mocks the Next session for `/next` actions (auth's test helpers vs. a module mock); running the two-connection tests against the CI Postgres service vs. the e2e database.
> - **Source:** FU-12 retro plan reviews: MO-1 W3, S1, S2; MO-2 W2, W3, S5.

## Constraints

- Owns `modules/billing/tests/`, the setup assertion (`src/server/setup.ts` and its two callers,
  `src/next/context.ts` and `src/server/health.ts`) and
  `examples/next-app/e2e/billing-entitlements.spec.ts`. Lane C: FU-27 and later billing items are
  not done here. A gap the new tests find is filed as a new FU item, not fixed.
- No new dependency; the Postgres tests use `@softure-ai/db` and the CI service that
  `SOFTURE_TEST_POSTGRES_URL` already points at.
- English-only code, comments and commits (AGENTS.md). No release, tag or publish (owner).

## Notes

- Research: kept. The item names two unknowns (how to mock the session, which Postgres to use), and
  the answer to the second decides whether the race tests can fail at all. A spike on Postgres found
  a real race (filed as a new FU item, see research finding 5).
- Framing skipped: the problem is stated by six retro findings with file references and confirmed by
  research; nothing about the problem is in doubt, only how to test it.
- Archived 2026-10-04: every billing server action and `requireWriteAccess` are unit-tested as
  anonymous, member and admin with the real auth checks; the first-insert race and concurrent manual
  grants run on Postgres (CI's service) with the order forced by a blocker connection, and each was
  seen failing under a mutation; an undeclared `adminRole` fails the first billing request and the
  readiness probe; the e2e covers an ended paid period. The spike's lifetime-grant race is FU-33.
