---
change_id: billing-entitlements
title: "Entitlements and the write guard"
status: archived
roadmap_item: MO-1
branch: claude/mo-1-billing-entitlements-go58sf
created: 2026-10-03
updated: 2026-10-03
archived_at: 2026-10-03
---

## Intent

`@softure-ai/billing` answers one question for every write an app makes: may this account still
write? A pure state machine turns an entitlement record (trial end, paid until, lifetime) into
`trial | paid | read_only`, with the trial length and the reminder windows from
`billing({ trial, paid })`. `billing.entitlements` holds at most one row per user, separate from
`auth.users`. `getEntitlement()` reads it, `requireWriteAccess()` guards app write actions,
`AccessBadge` and `AccessNotice` show where an account stands (slots, `unstyled`, messages), and a
privacy contributor exports and deletes the row.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item MO-1).

## Scope

- Migration `billing/0001_create_entitlements.sql`, Drizzle view, health check, privacy contributor.
- Pure core: `resolveEntitlement`, `applyEntitlementEvent` (grant, lifetime grant, revoke, trial
  extension), `getTrialEnd`; calendar days in the app's time zone.
- `/server`: `getEntitlement`, `checkWriteAccess`, `changeEntitlement` (the write MO-2 and MO-3 build on).
- `/next`: `getCurrentEntitlement`, `requireWriteAccess`, `CurrentAccessBadge`, `CurrentAccessNotice`.
- `/ui`: `AccessBadge`, `AccessNotice`.
- Example app: `/account/billing` with a guarded write; `e2e/billing-entitlements.spec.ts`.

Out of scope: plans, prices, the payment page and any payment adapter (MO-2, MO-3).
