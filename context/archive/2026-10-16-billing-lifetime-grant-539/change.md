---
change_id: billing-lifetime-grant-539
title: "billing: grant lifetime access without a lifetime plan, from the admin page and an ops script (issue #539)"
status: archived
roadmap_item: null
issue: 539
branch: claude/billing-lifetime-grant-lmks5a
created: 2026-10-16
updated: 2026-10-16
archived_at: 2026-10-16
---

## Intent

Close [issue #539](https://github.com/SOFTURE/AI/issues/539): an app that declares only dated plans has no built-in way
to give an account (its owner's, a complimentary one) lifetime access. The admin page's grant form and `grant-plan`
accept only declared plans, and `import-entitlements` needs a file that does not exist in the app container. The grant
must be recorded in `billing.manual_grants`, so it is in the account's history and revocable there.

## Context

billing is at 0.5.0 on master. Releases are batched by the coordinator through `auto-release.yml`; the CHANGELOG gets
`## Unreleased`.

## Constraints

- No migration: `manual_grants.plan_id` is free text (1 to 64 characters) and `amount`/`currency` are nullable.
- Plan grants, revokes and the history behave as before.

## Notes

- Framing: skipped. The issue names the gap, the cause and the expected options.
- Process deviation: the first source edits were made before research.md, plan.md and the plan review were written
  down; the artifacts below record the research and plan that preceded them, and the plan review was done on them
  before the tests and docs.

## Decisions (auto)

- Options 1 and 2 of the issue: `grant-lifetime --email=… [--commit]` and a "Lifetime access, free of charge" option
  in the admin grant form, both through a new `grantLifetimeManually(ctx, { userId, adminId })` (`/server`).
- The grant is recorded under `LIFETIME_GRANT_PLAN_ID = "_lifetime"`: plan ids are kebab-case (`PLAN_ID_PATTERN`),
  so no declared plan can collide, and it needs no migration. No price (complimentary).
- Option 3 (`import-entitlements --file=-` from stdin) is left out: it is optional, `grant-lifetime` covers the case
  through `deploy.sh run`, and reading stdin inside the script's open transaction is a separate design question.
- The form always lists the lifetime option after the plans; with no plans declared it shows the `noPlans` note and
  the form with only the lifetime option (the message now says lifetime needs no plan).
