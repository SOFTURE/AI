# Research: billing-existing-accounts

Input: change.md, roadmap FU-24, research.sources (`docs/`; FIRE_TRACKER is outside this session's
repository scope). Depth: normal.
Snapshot: 9ac4272 on claude/fu-24-billing-existing-accounts-ijtwes, 2026-10-04 04:40 UTC.

## Summary

An account without a `billing.entitlements` row has a trial derived from `auth.users.created_at` and
`trial.days` on every read (`modules/billing/src/server/entitlements.ts:18-20,37`), and reminder
mail finds such accounts by a range on `created_at` (`src/server/reminders.ts:88-101`). Nothing
writes a row for an existing account except a change (`changeEntitlement`). Three additions close
the gap: a trial floor option (`trial.startsAt`, a local day) that the derived record and the
reminder range both honour; an `import` entitlement event plus `importEntitlement()` and an
`import-entitlements` ops script reading a JSON file; and `pinDerivedTrials()` plus a `pin-trials`
ops script. Imported data is stored as raw entitlement rows (no plan, no grant record). README §3,
§4, §5 and §12 change.

## Current state

- `getDefaultRecord(ctx, accountCreatedAt)` (`entitlements.ts:18-20`) is the single place a derived
  trial is computed: `getTrialEnd(createdAt, trial.days, config.timezone)` (`src/calendar.ts:61-63`),
  the start of the local day `days` after the creation day.
- `findEntitlementRecord` (`entitlements.ts:24-38`) left-joins `auth.users` with the row and falls
  back to `getDefaultRecord`. `changeEntitlement` (`:77-122`) locks the account (key share), locks
  the row (`FOR UPDATE`), and either inserts the derived record with the event applied
  (`onConflictDoNothing`, then re-lock on conflict) or updates the stored row.
- `applyEntitlementEvent` (`src/entitlement.ts:55-77`) is the pure transition; events are the union
  `EntitlementEvent` (`src/contract.ts:61-76`). `grant` and `extend_trial` refuse an end not after
  `now`, so neither can record a trial or paid period that already ended.
- `findDerivedCandidates` (`reminders.ts:88-101`) turns the reminder window into a `created_at`
  range shifted back by `trial.days`; the pure rule (`src/reminder.ts:34-44`) then decides each
  candidate exactly. A trial floor moves every older account's trial end to one day, which this
  range would miss.
- Ops scripts (`modules/ops/src/scripts/ops-script.ts`) take `--key=value` strings, run in one
  transaction (rolled back without `--commit`), and must return `before` and `after`. The billing
  scripts (`src/scripts/plan-scripts.ts`) are the pattern: `defineOpsScript`, `z.strictObject` args,
  `refuseOpsScript` for expected conditions, reports with user ids, never emails.
- README §5 (`README.md`, "No row until something changes") claims accounts created before billing
  "get a trial too" and names only the `trial.days` effect.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Options | `src/options.ts` | `trial.startsAt` |
| Calendar | `src/calendar.ts` | parse a `YYYY-MM-DD` day into the day number `getDayNumber` uses |
| Derived trial | `src/server/entitlements.ts` | the floor in `getDefaultRecord`; `importEntitlement`, `pinDerivedTrials` |
| Events | `src/contract.ts`, `src/entitlement.ts` | an `import` event that merges a carried-over record |
| Reminders | `src/server/reminders.ts` | accounts under the floor are candidates when the floor's trial end is in the window |
| Scripts | `src/scripts/` (new `entitlement-scripts.ts`), `src/scripts/index.ts` | `import-entitlements`, `pin-trials` |
| Exports | `src/server/index.ts` | the two server functions |
| Docs | `README.md` §1, §3, §4, §5, §12; package description | the adoption path and the config effects |
| Example | `examples/next-app/scripts/`, `package.json`, `README.md`, `e2e/billing-entitlements.spec.ts` | the scripts on the built app |

## Data

No migration. `billing.entitlements` (`migrations/0001`, `0003`) already holds what an import needs:
`trial_ends_at NOT NULL`, `paid_until` nullable (kept under lifetime since `0003`), `is_lifetime`.
CHECK `updated_at >= created_at`. FIRE_TRACKER keeps `trial_ends_at` and `paid_until` on its users
table (`docs/01-module-assessment.md:29`; MO-1 research line 6-7); its own roadmap migrates its users
and will hand the operator the rows.

## Tests

`tests/entitlements.test.ts` (derived trial, changes), `tests/reminders.test.ts` (derived
candidates), `tests/plan-scripts.test.ts` (ops scripts via `executeOpsScript` / `runOpsScript`),
`tests/entitlement.test.ts` (pure events). All on PGlite via `tests/support.ts`
(`createTestBilling`, `createAccount`, `readRow`, a test clock at 3 October 2026 in Warsaw). E2e:
`examples/next-app/e2e/billing-entitlements.spec.ts` moves state in Postgres and reads the badge;
`billing-pricing.spec.ts:260-263` runs a script with `spawnSync("npm", ["run", ...])`.

## Patterns to follow

- Options: zod `strictObject` with a `/** */` per key (`src/options.ts:55-70`).
- Ops scripts: `src/scripts/plan-scripts.ts:93-125` (refusals, report shape, `clock` option).
- One write path: rows go through `changeEntitlement` (W1's fix names it), so the lock order and
  the first-insert race handling stay in one place.

## Prior work

- `context/archive/2026-10-03-billing-entitlements/`: the "no row until something changes" decision
  (research decision 1), and the retro review W1/W2 this change answers.
- `context/archive/2026-10-04-billing-grant-plan-script/`: the ops script pattern in billing.
- `context/archive/2026-10-04-billing-reminder-mail/`: derived candidates by a `created_at` range.

## SOFTURE modules

`@softure-ai/ops/scripts` covers the operator tool (dry run, one transaction, guard test). Nothing
else applies; no new module.

## Risks

- **The whole user base under the floor gets its trial-ending mail on one day.** Likely, and
  correct (that is when their trials end). Mitigation: README says so; the floor's day is the
  operator's choice.
- **An import shortens access.** Prevented by the merge rule (each end only moves later, lifetime
  only turns on), so a re-run or a stale file never takes access away. A wrong file that gives too
  much is fixed with `revoke` / `shorten` events, as any raw grant.
- **A pin racing an account deletion.** The batch insert's foreign key fails and the script's
  transaction rolls back; the operator re-runs. Rare (an operator step), loud, and nothing is lost.
- **A floor typed in the wrong format.** Refused at startup by the option's schema.

## Relevant lessons

None of L-001 / L-002 applies (no client or Next code).

## Answers to unknowns

- **Import format: ops script vs. server function.** Both, layered: `importEntitlement(ctx, input)`
  is the server function (for an app that migrates in its own code and holds user ids), and the
  `import-entitlements --file=<path>` ops script reads a JSON array of
  `{ email, trialEndsAt?, paidUntil?, isLifetime? }` and calls it for each row, dry run by default.
  A file, because ops arguments are single strings and a migration has many rows; JSON, because the
  dates carry offsets and zod validates it without a CSV parser. Emails, because the operator moves
  data between two databases where only the email is shared for sure.
- **Trial floor: option or only part of the import.** An option, `trial.startsAt` (`YYYY-MM-DD`, a
  local day in `config.timezone`): an account created before that day gets its trial from it. It
  covers every row-less account without writing anything (also those the import file lacks), keeps
  reads write-free, and is how a new app turns billing on late. An import-only floor would need a
  row per account.
- **Recording imported periods: manual grants vs. raw rows.** Raw entitlement rows, through a new
  `import` event of `changeEntitlement`. A manual grant needs a declared plan and a period the plan
  defines (`manual_grants.plan_id NOT NULL`, `grant_kind` checks); FIRE's `paid_until` is a date, not
  a payment of a plan. Raw rows keep the same limits as `grantPlan` today (README §12: not in the
  history, not revocable as a grant), which the README states for imports too.

## Open questions

- Should the import refuse or skip unknown emails? Decided (plan, safer option): refuse the whole
  run and name the rows, the ops rule "a row that does not match is a refusal".
- Does the pin take the floor into account? Yes: it writes exactly what reads derive
  (`getDefaultRecord`), so pinning changes no account's status.

## Decisions (auto)

- Event merge rule: later end wins for the trial and for dated paid access; lifetime only turns on;
  ends may lie in the past (an ended trial or period is recorded as it was).
