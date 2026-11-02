---
change_id: billing-free-tier-962
status: planned
---

# Plan: a free tier without an end (issue #962)

Input: change.md, research.md (option 1). Complexity: medium (one package, a migration).

## Phase 1: the state, limits and the quota refusal (TDD)

Files: `src/{contract,options,entitlement,usage,index}.ts`, `src/server/{options,usage}.ts`, tests
`entitlement.test.ts`, `limits.test.ts`, `usage.test.ts`.

- Option `free: { limits }` (optional; absent means no free tier).
- `ENTITLEMENT_STATUSES` gains `free`; `Entitlement` gains `{ status: "free"; since; reason }` (as read-only's).
  Trial and paid states gain `afterEnd: "free" | "read_only"`.
- `EntitlementPolicy.hasFreeTier` (from the options); `resolveEntitlement` returns `free` where it returned
  `read_only`. `hasWriteAccess` is unchanged (free writes).
- `resolveLimit` reads `free.limits`; `getDeclaredMeters` lists it.
- `QuotaExhausted.upgradePlanIds`: the declared plans whose limit for the meter is higher than the current one
  (null counts as higher), in config order.

## Phase 2: copy, UI, reminders, scripts, testing factories

Files: `src/messages/en.ts`, `src/ui/{access-badge,access-notice}.tsx`, `src/reminder.ts`,
`src/mailing/reminder-mail.ts`, `src/server/reminders.ts`, `src/scripts/{status-script,entitlement-scripts}.ts`,
`src/testing/entitlement.ts`, their tests.

- Badge kind `free` ("Free", neutral). Notice for `free`: neutral, "you are on the free plan", a link to the plans;
  ending notices with `afterEnd: "free"` say the account keeps the free plan.
- Reminders: `AccessReminder.afterEnd`; the mail renders free variants of the four copies (`trialEndingFree`, ...).
  The ended mails are due for `free` as they are for `read_only`.
- `entitlement-status` reports `free`; `import-entitlements` summary counts `free`.
- `setTestEntitlementState` takes `{ status: "free" }` (the record is the read-only one; the state depends on the
  config).

## Phase 3: SQL surface

Files: `migrations/0013_add_free_tier_to_entitlement_states.sql`, `src/server/entitlement-sql.ts`,
`tests/entitlement-sql.test.ts`.

- Drop and recreate both functions with a last parameter `has_free_tier boolean DEFAULT false`, status `free`, and
  two columns appended: `free_since`, `free_reason`. Rollback re-creates 0012's functions.
- `getEntitlementStatesSql` passes `free !== undefined`. The equivalence test runs a free-tier policy too.

## Phase 4: docs

README (options, states, usage limits, SQL surface, testing), `CHANGELOG.md` `## Unreleased` with the migration
steps for an app that emulates freemium today.

## Decisions (auto)

- `free` reuses read-only's `since`/`reason`: they say which access ended last, which the copy needs.
- `afterEnd` on the ending states rather than a config lookup in the UI: the badge and the notice render from props.
- No operator restriction is added: none exists today, and the issue's ask is the free state. With a free tier no
  account reaches read-only.
- `upgradePlanIds` (not a boolean): an upgrade prompt can name the plans; empty means no plan raises it.
- No version bump: the coordinator releases the batch.

## Progress

- [ ] Phase 1: the state, limits and the quota refusal
- [ ] Phase 2: copy, UI, reminders, scripts, testing factories
- [ ] Phase 3: SQL surface
- [ ] Phase 4: docs
- [ ] Implementation review
