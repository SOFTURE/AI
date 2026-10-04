---
change_id: billing-grant-plan-script
title: "A grant-plan ops script grants and revokes plans without the admin page"
status: archived
roadmap_item: FU-22
branch: claude/fu-22-8tf7fa
created: 2026-10-04
updated: 2026-10-04
archived_at: 2026-10-04
---

## Intent

An operator of an app without the billing admin page (or at a terminal) grants a plan to an account
by email and revokes a manual grant with an ops script, and the grant lands in the account's history
exactly like one made in the admin page. Guard tests on PGlite cover both scripts.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-22).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-22** (roadmap `followups`):

> - **Outcome:** `@softure-ai/billing/scripts` exports `grant-plan` and `revoke-grant` ops scripts (dry run by default, `--commit` writes) that grant a plan to an account by email and revoke a manual grant, recorded in the account's history like the admin page's grants.
> - **Unknowns:** Whether billing may depend on `@softure-ai/ops` (auth does, for `grant-role`); how the script names a grant to revoke (its id from the history vs. the latest active grant of a plan).
> - **Baseline:** FU-9 `billing-admin-requests`: manual grants are recorded only through the admin page or the server API; the roadmap's optional script was left out (README §12).

The pattern to follow is `modules/auth/src/scripts/role-scripts.ts` (`createGrantRoleScript`) and
`examples/next-app/scripts/grant-role.ts`. The scripts write through `grantPlanManually` and
`revokeManualGrant` (`src/server/grants.ts`); `grantPlan` records nothing and is not used.

## Constraints

- Owns `modules/billing/` scripts export, its README and tests, and the example app's billing
  scripts. Lane C: FU-24 and later billing items are not done here. Other gaps go to the followups
  roadmap as new FU items.
- No migration: `billing.manual_grants.granted_by` / `revoked_by` are nullable already (FU-9, `0004`).
- English-only code, comments and commits (AGENTS.md). No release, tag or publish (owner).

## Notes

- Framing skipped: the outcome, its baseline and the pattern to copy are stated; the problem is not
  in doubt. Research is kept short: it answers the two unknowns and checks the nested transaction.
- Archived 2026-10-04: `@softure-ai/billing/scripts` exports `createGrantPlanScript` and
  `createRevokeGrantScript` (`grant-plan --email --plan`, `revoke-grant --email --grant`), dry run by
  default, writing through `grantPlanManually` / `revokeManualGrant`; the example app runs them as
  `npm run grant-plan` / `revoke-grant`, with an e2e next to the admin page's.
