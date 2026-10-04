# Plan review: billing-entitlements

Written after the fact by FU-12 (`billing-retro-reviews`, 2026-10-04): MO-1 skipped its plan review.
The plan is reviewed as written, and every finding is checked against the code on `master` today.
Snapshot: b6c92c4 (master, 2026-10-04), after MO-3, FU-11 and FU-9.

Reviewed: plan.md @ 2026-10-04. Mode: deep (retro). Verdict: ready after fixes (would have been).
Findings: 0 critical, 3 warning, 3 suggestion.
Grounding: 19/19 paths, symbols, commands and commits named in plan.md exist today (migration 0001
and its six columns, `trial`/`paid` options, `/account/billing`, the four e2e specs,
`scripts/container.mjs`, `requireWriteAccess`, `changeEntitlement`, `billing.read_only`,
`module.json`, README §1-12, commits 80a59d7 and f3f5aa7, the gate commands). One is placed
inexactly: `routes: { payment }` is not in the options schema (`modules/billing/src/options.ts:51-82`)
but a manifest route that core overrides (`foundation/core/src/module.ts:126-129`) (S3).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | WARN (W1) |
| Slicing | PASS: phase 1 is the module, phase 2 the example and e2e; each left the gates green |
| Verifiability | PASS |
| Data and migrations | PASS: PK and FK `ON DELETE CASCADE`, two CHECKs, rollback note (`migrations/0001_create_entitlements.sql:4-5,7,14-15`) |
| Tests | WARN (W3, S1, S2) |
| Security | PASS: no ids bound to actions; ids parsed as UUIDs before a query (`src/server/user-id.ts:3-12`); the guard fails closed (`src/next/current-entitlement.ts:34`) |
| Lean | PASS |
| Fit | PASS: calendar days in the app's zone as in mcp-access; `sft:` tokens only (`src/ui/access-badge.tsx:24-29`) |
| Cost and defaults | WARN (W2) |
| Scope | PASS |
| Reuse | PASS: auth's user and session, core's Result and clock, privacy contributors |
| Lessons | PASS (none applied) |
| Progress format | PASS |

## Findings

### W1 [WARNING] Existing accounts are read-only the moment billing is enabled, and there is no import path
**Effort:** medium. **Lens:** Coverage and end state. **Where:** research.md decision 1, plan "Trial row" · `modules/billing/src/server/entitlements.ts:18-20,37` · `modules/billing/README.md:7-11,268-270`
**Problem:** The plan says accounts that existed before billing was enabled "get a trial too". They
do, but it starts at `auth.users.created_at`, so any account older than `trial.days` is read-only on
the first read after the upgrade. The README repeats the claim. The module is also meant to replace
FIRE_TRACKER's `trial_ends_at` / `paid_until` columns (`README.md:7-11`), yet nothing imports them:
paying FIRE users would lose access on migration.
**Fix:** A way to adopt existing accounts: an import of known trial ends and paid periods (rows
written through `changeEntitlement`), plus an optional trial floor for accounts created before a
given date; correct the README sentence.
**Still applies:** yes.
**Decision:** Defer - FU-24 (`billing-existing-accounts`).

### W2 [WARNING] A config change silently moves every derived trial
**Effort:** low. **Lens:** Cost and defaults. **Where:** plan "Trial row" · `entitlements.ts:19` · `README.md:271-272`
**Problem:** Row-less trials are recomputed from `trial.days` and `config.timezone` on every read.
Shortening `trial.days` makes accounts read-only at once, lengthening it reopens trials that had
ended, and changing the zone moves every trial end. The README names only the first, in one
sentence; there is no way to pin derived trials before such a change.
**Fix:** Document all three effects, and offer a pin step (write the derived trial into rows) that
the same import tool as W1 can run.
**Still applies:** yes, partially documented.
**Decision:** Defer - FU-24 (`billing-existing-accounts`).

### W3 [WARNING] The first-insert race is only argued, never tested
**Effort:** medium. **Lens:** Tests. **Where:** plan "Changes" row · `entitlements.ts:94-108` · `tests/entitlements.test.ts:140` · `tests/support.ts:24`
**Problem:** Two first changes at once take the `onConflictDoNothing` branch and re-lock the row.
The only race test runs on PGlite, one connection, so the second change always finds a stored row
and the branch never runs. Impl review #5 confirmed the READ COMMITTED behaviour by reasoning.
**Fix:** A two-connection test against Postgres (the CI service), for this branch and for MO-2's
concurrent grants.
**Still applies:** yes.
**Decision:** Defer - FU-26 (`billing-guard-race-tests`).

### S1 [SUGGESTION] `requireWriteAccess` has no module test
**Effort:** low. **Lens:** Tests. **Where:** `src/next/current-entitlement.ts:30-36`
**Problem:** No unit test calls the guard; its fail-closed branch (no entitlement → `billing.read_only`)
is covered nowhere, and the e2e checks the page redirect, not an action called without a session.
**Fix:** Unit tests with a mocked session: none (redirect), unknown account (`read_only`), trial (`Ok`).
**Still applies:** yes.
**Decision:** Defer - FU-26 (`billing-guard-race-tests`).

### S2 [SUGGESTION] The e2e covers only `trial_ended`
**Effort:** low. **Lens:** Tests. **Where:** `examples/next-app/e2e/billing-entitlements.spec.ts:107-120`
**Problem:** A paid period that ended (`paid_ended`) is covered by unit tests only (`tests/entitlement.test.ts:46`).
**Fix:** One e2e case with an expired paid period.
**Still applies:** yes.
**Decision:** Defer - FU-26 (`billing-guard-race-tests`).

### S3 [SUGGESTION] The plan lists `routes` among the options
**Effort:** low. **Lens:** Fit. **Where:** plan "Goal" · `src/options.ts:51-82` · `src/index.ts:48`
**Problem:** Routes are manifest routes overridden through core, not a `billing()` option; the code
and README (`README.md:84-86`) are right, the plan's wording is not.
**Still applies:** no code impact.
**Decision:** Dismiss - wording only; recorded here.

## Checked without findings

- Lock order: account (key share) then row (`entitlements.ts:90,93`); the privacy erase locks the
  account first (`src/server/privacy.ts:137`), as impl review #4 fixed.
- A refused event writes nothing (`entitlements.ts:96-97`, `tests/entitlements.test.ts:130`).
- DST and zones: the midnight-gap fix (`src/calendar.ts:53-55`), tests at `tests/calendar.test.ts:8-14,21-27,43`;
  access ends exactly at its end (`src/entitlement.ts:22,26`).
- Privacy export and delete cover the entitlement row and, since MO-3 and FU-9, the later tables
  (`src/server/privacy.ts:75-144`).
- Messages: `pl` is typed as `en` (`src/messages/pl.ts:3`), both complete (`tests/messages.test.ts`).
- Options validated with zod (`src/options.ts:19,51-65`); a reminder window of 0 days never opens.

## Changed since MO-1

- FU-11 dropped `entitlements_lifetime_without_end` (migration 0003): `paid_until` now lives on
  under lifetime, and `shorten` / `end_lifetime` events exist (`src/entitlement.ts:61-72`).
- MO-3 and FU-11 replaced a refund's `revoke` with `shorten`; `revoke` stays for pre-0003 payments.

## Triage summary
Fixed: -. Accepted: -. Deferred: W1, W2 (FU-24), W3, S1, S2 (FU-26). Dismissed: S3.
Verdict after triage: ready after fixes (retro; the deferred items carry the fixes).

## Decisions (auto)
- W1 existing accounts → Defer to FU-24 (needs code; owner rule 2026-10-03: gaps go to followups).
- W2 config change moves derived trials → Defer to FU-24 (same tool as W1).
- W3 first-insert race untested → Defer to FU-26.
- S1 guard untested → Defer to FU-26.
- S2 `paid_ended` e2e → Defer to FU-26.
- S3 `routes` wording → Dismiss (code and README correct).
