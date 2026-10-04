# Plan review: billing-existing-accounts

Reviewed: plan.md @ 2026-10-04. Mode: deep (money and existing data). Verdict: ready after fixes.
Findings: 0 critical, 3 warning, 3 suggestion.
Grounding: 9/9 paths, 8/8 symbols (`getDefaultRecord`, `changeEntitlement`, `applyEntitlementEvent`,
`findDerivedCandidates`, `getAccessReminder`, `findAccountByEmail`, `defineOpsScript`,
`refuseOpsScript`), 4/4 commands (`npm run typecheck|lint|test|build`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: floor, import, pin and the README effects each have a phase and tests; W1/W2 of the MO-1 retro review are answered |
| Slicing | PASS: each phase leaves the gates green; phase 1 needs nothing from phase 2 |
| Verifiability | PASS |
| Data and migrations | PASS: no migration; rows written are those `changeEntitlement` writes; `paid_until` beside lifetime is allowed since `0003` |
| Tests | WARN (W3) |
| Security | PASS: operator-only scripts; reports and refusals carry user ids and row numbers, never emails |
| Lean | WARN (S1) |
| Fit | PASS: local days as in the rest of billing; ops script shape of `plan-scripts.ts` |
| Cost and defaults | WARN (W2) |
| Scope | PASS: no history import, no CSV, no FIRE changes |
| Reuse | PASS: `changeEntitlement` stays the one write path; `findAccountByEmail` |
| Lessons | PASS (none applies) |
| Progress format | PASS |

## Findings

### W1 [WARNING] Duplicate detection must compare emails the way auth stores them
**Effort:** low. **Lens:** Coverage and end state. **Where:** Phase 2, step 3 · `src/server/plans.ts:31-37`
**Problem:** `findAccountByEmail` trims and lower-cases. Two rows `Ada@x` and `ada@x` would both
resolve to one account and import twice, the second silently merging over the first.
**Fix:** Compare trimmed, lower-cased emails when looking for duplicates; test it.
**Decision:** Fix now (applied) - step 3 and the tests name the normalisation.

### W2 [WARNING] An imported trial end earlier than the derived one is not recorded
**Effort:** low. **Lens:** Cost and defaults. **Where:** Key decisions, merge rule
**Problem:** For a row-less account the import merges onto the derived (possibly floored) trial, so a
FIRE `trial_ends_at` earlier than that is dropped. An operator could expect the file to win.
**Fix:** Keep the rule (an import never takes access away, re-runs are no-ops) and say it in the README.
**Decision:** Accept risk - generous by design; README §4 states it (auto).

### W3 [WARNING] Rows with no field
**Effort:** low. **Lens:** Tests. **Where:** Phase 2, step 3
**Problem:** `{ "email": "…" }` alone would "import" nothing yet pin the derived trial into a row,
which is a pin of one account under the import's name.
**Fix:** Require at least one of `trialEndsAt`, `paidUntil`, `isLifetime` per row.
**Decision:** Fix now (applied) - schema rule and a refusal test.

### S1 [SUGGESTION] Drop the `readFile` option
**Effort:** low. **Lens:** Lean. **Where:** Phase 2, step 3
**Problem:** Tests can write a temporary file; an injectable reader is API surface for tests only.
**Fix:** Read with `node:fs/promises`, relative to the working directory.
**Decision:** Fix now (applied).

### S2 [SUGGESTION] State the reminder condition in day numbers
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 1, step 4
**Problem:** "`[from + days, to + days)`" mixes instants and days.
**Fix:** The floor's trial end day `floorDay + days` lies from `today - catchUpDays` to
`today + trial.reminderDays`.
**Decision:** Fix now (applied).

### S3 [SUGGESTION] Large imports run in one transaction
**Effort:** low. **Lens:** Cost and defaults. **Where:** Phase 2
**Problem:** About six queries per row inside one transaction; tens of thousands of rows hold locks
for the run.
**Fix:** README says imports are one transaction and suggests splitting very large files.
**Decision:** Accept risk - FIRE's base is small; documented (auto).

## Triage summary
Fixed: W1, W3, S1, S2. Accepted: W2, S3. Deferred: -. Dismissed: -. Verdict after triage: ready.

## Decisions (auto)
- W2 → Accept: an import must never shorten access; documented.
- S3 → Accept: documented; splitting a file is the operator's lever.
