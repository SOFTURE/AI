---
change_id: billing-access-changed-hook-696
status: in_progress
---

# Plan: a hook when access changes, and the account in onDelivery (issue #696)

Input: change.md, research.md. Complexity: small (one package: one option, one notifier, call sites, docs).

## Phase 1: onAccessChanged (TDD, PGlite)

Files: `src/options.ts`, `src/contract.ts`, `src/server/access-changed.ts` (new), `src/server/grants.ts`,
`src/server/trials.ts`, `src/server/payments.ts`, `src/server/index.ts`, `src/index.ts`,
`tests/access-changed.test.ts` (new).

1. Tests first: a manual plan grant, a lifetime grant and a request grant call the hook once with
   `{ accountId, change: "granted", planId, endsAt, entitlement }` and the context; a revoke and a provider refund
   (full and partial pro rata) call it with `refunded`; a trial extension with `trial_extended` and the new trial
   end; a provider payment with `granted`; a failed refund with `granted`; a refusal, a duplicate and an unknown
   payment call nothing; the hook sees the change committed (reads it through `ctx.db`); a throwing or rejecting hook
   leaves the change done, returns its result and logs the change kind and the error label without the account id.
2. `AccessChange = "granted" | "refunded" | "trial_extended"`, `AccessChangedEvent`, `OnAccessChanged` in
   `contract.ts`; `onAccessChanged: z.custom<OnAccessChanged>(function).optional()` in the options.
3. `notifyAccessChanged(ctx, event)` (server-internal): reads the hook, awaits it, catches and logs.
4. Called after the transaction in `recordManualGrant` (covers the three grant functions), `revokeManualGrant`,
   `extendTrialManually`, `recordPayment`, `refundPayment` (`refunded`, `partially_refunded`), `failRefund`
   (`refund_failed`).

## Phase 2: onDelivery with the account

Files: `src/mailing/reminder-mail.ts`, `src/mailing/index.ts`, `tests/reminder-mail.test.ts`.

1. Test first: `onDelivery` gets `(outcome, { accountId, kind, scope })` for every delivery, with the app's scope
   when `getScope` is given, and nothing for a skipped account.
2. `SendAccessRemindersOptions` omits mailing's `onDelivery` and declares
   `onDelivery?: (outcome, reminder: AccessReminderDelivery) => void`; `build` remembers the delivery it built and the
   wrapper passes it.

## Phase 3: docs

Files: `modules/billing/README.md`, `CHANGELOG.md` (Unreleased).

1. README: the hook (when it fires, what it gets, after the commit, errors logged) and the second `onDelivery`
   argument; the app's migration (drop the polling / `buildMail` pairing).

## Decisions (auto)

- `planId` instead of the issue's `plan`: the field carries the plan id (`LIFETIME_GRANT_PLAN_ID` for a lifetime
  granted without a plan, null for a trial extension), and the full `entitlement` is passed too, so the app can set
  its person properties without a read.
- `endsAt`: the end of the access the change is about: the new trial end for `trial_extended`, otherwise paid
  access' end after the change (null for lifetime, or when no paid access is left).
- A revoked manual grant is reported as `refunded`: for the app both take access back; three kinds, as proposed.
- Provider payments, refunds and failed refunds are reported too (a failed refund gives access back, so `granted`):
  the hook means "access changed", whichever path changed it. A partial refund under `keep_access` changes nothing
  and is still reported as `refunded` with the unchanged end, so the app can record the money event.
- Low-level `grantPlan`, `changeEntitlement` and `importEntitlement` stay silent: they run inside callers'
  transactions and record nothing.
- `onDelivery` pairing stays inside billing (no mailing change): runDeliveries' order is part of its contract
  ("in order"), and a test pins it.

## Progress

- [x] Phase 1
- [ ] Phase 2
- [ ] Phase 3
