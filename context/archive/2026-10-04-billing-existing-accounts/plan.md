# Plan: billing-existing-accounts

Input: change.md, research.md. Complexity: medium.

## Goal

An app turning billing on for existing users keeps their access:

- `billing({ trial: { startsAt: "2026-11-01" } })` gives every account created before 1 November
  (local day in `config.timezone`) a trial of `trial.days` from that day; reads, the guard and the
  reminder mail all see it, and nothing is written.
- `import-entitlements --file=<json>` (and `importEntitlement()` on the server) records known trial
  ends, paid periods and lifetime access in `billing.entitlements`, never shortening what an account
  has; dry run by default.
- `pin-trials` (and `pinDerivedTrials()`) writes every row-less account's derived trial into a row,
  so a later `trial.days`, `trial.startsAt` or time zone change moves no existing trial.
- README §5 says what a change of `trial.days`, `trial.startsAt` and `config.timezone` does to
  accounts without a row, and the intro's claim about existing accounts is corrected.

**Out of scope:** FU-25 and later lane C items; importing into the history (manual grants or
payments); a CSV format; FIRE_TRACKER's own migration (its roadmap runs these scripts); paging the
pin beyond batches in one transaction.

## Approach

**Starting point:** a row-less account's trial is `getDefaultRecord` (`src/server/entitlements.ts:18-20`)
from `created_at`; the only write path is `changeEntitlement` (`:77-122`); reminders find row-less
accounts by a `created_at` range (`src/server/reminders.ts:88-101`).

**Chosen:** the floor inside `getDefaultRecord` (one place for derived trials, so reads, the first
change, the pin and reminders agree), a new `import` event so imports go through `changeEntitlement`
(locks, first-insert race and the derived-then-applied insert stay in one place), and two ops scripts
in the shape of `plan-scripts.ts`.
Rejected: imports as manual grants - need a plan and a plan-shaped period FIRE's dates are not;
an import-only floor - writes a row per account and misses accounts the file lacks; a raw `INSERT`
in the script - a second write path beside `changeEntitlement`.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Floor format | `trial.startsAt: "YYYY-MM-DD"`, a local day | trials are counted in local days already | research |
| Floor rule | start day = later of the creation day and the floor day | accounts created on or after the floor are unchanged | plan |
| Import record | raw row via `{ type: "import", trialEndsAt, paidUntil, isLifetime }` | no plan behind FIRE's dates | research |
| Merge rule | each end only moves later; lifetime only turns on; past ends allowed | an import never takes access away; re-runs are no-ops | research |
| Script input | `--file=<path>` JSON array of `{ email, trialEndsAt?, paidUntil?, isLifetime? }` | many rows, dates with offsets, zod-validated | research |
| Bad rows | refuse the whole run, naming row numbers (never emails) | ops rule; privacy of reports | plan |
| Pin | insert `getDefaultRecord` for row-less accounts in batches of 500, `ON CONFLICT DO NOTHING` | writes exactly what reads derive | research |

**Critical details:** the floor's day number must be the same unit `getDayNumber` returns (local
wall time as UTC days), so `Date.UTC(y, m - 1, d) / DAY_MS`. Reminder candidates under the floor:
when the floor's trial end lies in the derived window, every row-less account created before the
floor's start is a candidate; the pure rule still decides.

## Phase 1: Trial floor

**Discipline:** TDD. **Files:** `src/calendar.ts`, `src/options.ts`, `src/server/entitlements.ts`,
`src/server/reminders.ts`, `tests/calendar.test.ts`, `tests/entitlements.test.ts`,
`tests/reminders.test.ts`, `tests/module.test.ts` (or wherever options are tested)

1. `src/calendar.ts`: `parseDay(day: string): number | null`, the day number of a `YYYY-MM-DD`
   calendar day (null for an invalid date such as `2026-02-30`).
2. `src/options.ts`: `trial.startsAt` optional string, refined by `parseDay`, documented.
3. `src/server/entitlements.ts`: `getDefaultRecord` starts the trial on the later of the creation day
   and the floor day: `getStartOfDay(max(day(createdAt), floorDay) + days)`.
4. `src/server/reminders.ts`: `findDerivedCandidates` also takes row-less accounts with
   `created_at < start of the floor day` when the floor's trial end day (`floorDay + days`) lies from
   `today - catchUpDays` to `today + trial.reminderDays`.

**Tests:** an account created before the floor gets `days` from the floor day; one created on the
floor day or after keeps its own trial; without the option nothing changes; a floor with
`trial.days: 0` gives no trial; an invalid floor (`2026-02-30`, `2026-1-1`) fails config parsing;
reminders: accounts under the floor get `trial-ending` in the floor trial's window and not before,
and `trial-ended` in the catch-up days.

**Done when:**
- Automated: the floor tests pass; Gates green (typecheck, lint, test).

## Phase 2: Import and pin

**Discipline:** TDD. **Files:** `src/contract.ts`, `src/entitlement.ts`, `src/server/entitlements.ts`,
`src/server/index.ts`, `src/scripts/entitlement-scripts.ts`, `src/scripts/index.ts`,
`tests/entitlement.test.ts`, `tests/entitlements.test.ts`, `tests/entitlement-scripts.test.ts`

1. `src/contract.ts` / `src/entitlement.ts`: event `import` with `trialEndsAt: Date | null`,
   `paidUntil: Date | null`, `isLifetime: boolean`; merge rule as decided; never refused.
2. `src/server/entitlements.ts`: `importEntitlement(ctx, { userId, trialEndsAt?, paidUntil?,
   isLifetime? }): Promise<Ok<Entitlement> | Err<"billing.account_unknown">>` through
   `changeEntitlement`; `pinDerivedTrials(ctx): Promise<number>` (rows written).
3. `src/scripts/entitlement-scripts.ts`: `createImportEntitlementsScript(config, { clock? })`
   (`import-entitlements --file=…`, the path relative to the working directory) and `createPinTrialsScript(config, { clock? })`
   (`pin-trials`, no arguments). Import refusals: unreadable file, invalid JSON, a row failing the
   schema (`row 3: …`; a row needs at least one of the three fields), duplicate emails (compared
   trimmed and lower-cased, as auth stores them), unknown emails (row numbers, at most 10 listed), an empty
   array. Reports: import `{ accounts, trial, paid, readOnly, withoutRow }` over the imported
   accounts; pin `{ withoutRow }` over all accounts.
4. `src/server/index.ts`, `src/scripts/index.ts`: exports.

**Tests:** pure merge (later ends win, past ends kept, lifetime only on, no-op re-apply); an import
into a row-less account starts from its derived (floored) trial; into a stored row merges; unknown
account; a read-only old account becomes paid; script dry run writes nothing and reports; commit
writes; every refusal writes nothing; output never carries an email; pin writes the derived trial for
row-less accounts only, leaves stored rows, is idempotent, and after a `trial.days` change the pinned
trials stay; duplicate emails differing only in case are refused; a row with no field is refused.

**Done when:**
- Automated: import and pin tests pass; Gates green (typecheck, lint, test).

## Phase 3: Example app and README

**Discipline:** test-after. **Files:** `examples/next-app/scripts/{import-entitlements,pin-trials}.ts`,
`examples/next-app/package.json`, `examples/next-app/README.md`,
`examples/next-app/e2e/billing-entitlements.spec.ts`, `modules/billing/README.md`,
`modules/billing/package.json` (description)

1. Example scripts and `package.json` entries, README rows.
2. E2e: an account older than its trial (its `created_at` moved back in Postgres) is read-only; the
   `import-entitlements` script with a paid period makes it paid and its write goes through;
   `pin-trials` dry run exits 0 and writes nothing.
3. README: §1 scripts and functions, §3 `trial.startsAt` row, §4 "Existing accounts" (the order:
   floor, import, pin) with the file format and refusals, §5 rewritten "No row until something
   changes" with the three config effects, §12 imports not in the history.

**Done when:**
- Automated: the e2e passes against Postgres 16 (locally or in CI); Gates green (typecheck, lint, test).
- Manual: the README's adoption steps read as one procedure an operator can follow.

## Risks and rollback

- Floor misread by reminders → covered by reminder tests in phase 1.
- A merge that shortens access → pure tests in phase 2 assert no end moves earlier.
- Rollback: no migration; revert the commits. Rows written by an import or pin stay valid rows
  (they are what `changeEntitlement` would write) and can stay.

## Decisions (auto)

- `trial.startsAt` named as the roadmap suggested; documented as "the first day a trial can start".
- Unknown emails refuse the whole import (safer than skipping).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Trial floor

#### Automated
- [x] 1.1 An account created before `trial.startsAt` has a trial of `trial.days` from the floor day; later accounts are unchanged — a96b83e
- [x] 1.2 An invalid `trial.startsAt` fails config parsing — a96b83e
- [x] 1.3 Reminder mail finds accounts under the floor in the floor trial's window — a96b83e
- [x] 1.4 Gates green (typecheck, lint, test) — a96b83e

### Phase 2: Import and pin

#### Automated
- [x] 2.1 The `import` event merges without shortening any end — 1a31924
- [x] 2.2 `importEntitlement` and `import-entitlements` record rows; refusals write nothing; no email in output — 1a31924
- [x] 2.3 `pinDerivedTrials` and `pin-trials` write derived trials for row-less accounts only, idempotently — 1a31924
- [x] 2.4 Gates green (typecheck, lint, test) — 1a31924

### Phase 3: Example app and README

#### Automated
- [x] 3.1 The e2e (old account read-only, import makes it paid, pin dry run) passes — 19a5605
- [x] 3.2 Gates green (typecheck, lint, test) — 19a5605

#### Manual
- [x] 3.3 The README's adoption steps read as one procedure an operator can follow — 19a5605 (verified by agent: README §4 "Existing accounts" read end to end as floor, import, pin)
