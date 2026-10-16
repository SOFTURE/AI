---
change_id: billing-lifetime-grant-539
status: archived
---

# Plan: lifetime access without a lifetime plan (issue #539)

Input: change.md, research.md. Complexity: small (one package, no migration).

## Phase 1: server

`src/plans.ts` (`LIFETIME_GRANT_PLAN_ID`, root export), `src/server/grants.ts`: one private `recordManualGrant` for a
plan or a lifetime target; `grantPlanManually` keeps its contract; new `grantLifetimeManually` (`/server`) refuses an
unknown account and lifetime access. Tests in `tests/grants.test.ts` with dated plans only: recorded row (plan id,
no price, kind), history entry, kept periods, refusals, revoke.

## Phase 2: admin page and script

`src/next/actions.ts` (`grantPlanAction` accepts the lifetime id), `src/next/pages.tsx` (option after the plans,
history name `admin.history.lifetime`), `src/messages/en.ts` (`grantedLifetime`, `lifetimeOption`, `noPlans`),
`src/scripts/plan-scripts.ts` + `index.ts` (`createGrantLifetimeScript`). Tests: `next-guards.test.ts`,
`pages.test.tsx`, `plan-scripts.test.ts`.

## Phase 3: docs

README (admin page, server functions, scripts, limits), CHANGELOG `## Unreleased`.

## Progress

- [x] Phase 1: server
- [x] Phase 2: admin page and script
- [x] Phase 3: docs

Gates on the branch: typecheck, lint (with the language gate) and `npm test` (pre-push).
