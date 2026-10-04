---
change_id: billing-grant-plan-script
title: "A grant-plan ops script grants and revokes plans without the admin page"
status: backlog
roadmap_item: FU-22
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

An operator of an app without the billing admin page (or at a terminal) grants a plan to an account
by email and revokes a manual grant with an ops script, and the grant lands in the account's history
exactly like one made in the admin page.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-22** (roadmap `followups`):

> - **Outcome:** `@softure-ai/billing/scripts` exports `grant-plan` and `revoke-grant` ops scripts (dry run by default, `--commit` writes) that grant a plan to an account by email and revoke a manual grant, recorded in the account's history like the admin page's grants.
> - **Unknowns:** Whether billing may depend on `@softure-ai/ops` (auth does, for `grant-role`); how the script names a grant to revoke (its id from the history vs. the latest active grant of a plan).
> - **Baseline:** FU-9 `billing-admin-requests`: manual grants are recorded only through the admin page or the server API; the roadmap's optional script was left out (README §12).

The pattern to follow is `modules/auth/src/scripts/role-scripts.ts` (`createGrantRoleScript`) and
`examples/next-app/scripts/grant-role.ts`.

## Constraints

- Owns: `modules/billing/` scripts export (lane C, after FU-21).

## Notes
