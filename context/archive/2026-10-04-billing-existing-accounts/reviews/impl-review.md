# Implementation review: billing-existing-accounts

Reviewed: the branch diff (`modules/billing/{src/calendar.ts,src/options.ts,src/contract.ts,src/entitlement.ts,src/server/{entitlements,reminders,index}.ts,src/scripts/,tests/,README.md,package.json}`,
`examples/next-app/{scripts/import-entitlements.ts,scripts/pin-trials.ts,package.json,README.md,e2e/billing-entitlements.spec.ts}`)
against plan.md and the plan review. Verdict: **approved**, no open findings.

## Plan conformance

| Step | Result |
| --- | --- |
| Phase 1: trial floor | Done: `parseDay` (calendar), `trial.startsAt` refined by it, `getDefaultRecord` starts on the later of the creation day and the floor day; `findDerivedCandidates` adds every row-less account under the floor when the floor's end day is in the window (plan review S2's day-number form). |
| Phase 2: import and pin | Done: the `import` event (later ends win, lifetime only on, never refused), `importEntitlement` through `changeEntitlement`, `pinDerivedTrials` in batches of 500 with `ON CONFLICT DO NOTHING`; `import-entitlements --file=` and `pin-trials` scripts. W1 (emails compared lower-cased), W3 (a row needs a field) and S1 (no `readFile` option) are in. |
| Phase 3: example and README | Done: two example scripts and entries, a README row; two e2e tests; README intro, §1, §3 (`trial.startsAt` row), §4 "Existing accounts", §5 table of config effects, §12. |

## Checks

| Check | Result |
| --- | --- |
| Correctness | Merge rule tested pure (no end moves earlier, re-apply is a no-op) and on PGlite (row-less account onto its derived trial, stored row, lifetime). The floor is in the one place every derived trial comes from, so reads, the first change, the pin and reminders agree (tests for each). |
| Tests that bite | Disabling the reminder floor branch fails two tests (the floor case and the brute-force cross-check with a floor); the pin test asserts a later `trial.days` change leaves pinned trials where they were. |
| Concurrency | Imports take `changeEntitlement`'s locks (account key share, row `FOR UPDATE`), held to the script's commit. A pin's insert skips rows a change wrote meanwhile; an account deleted under it fails the foreign key and rolls the run back (research risk, accepted). |
| Errors | Expected conditions are refusals that write nothing (unreadable file, invalid JSON, schema, repeats, unknown emails, row limit); an `import` refusal that cannot happen throws. |
| Privacy | Reports are counts; refusals name row numbers; unit and e2e tests assert no email in the output. No new personal data: rows are the entitlement rows the privacy contributor already exports and deletes. |
| Docs | README states what each config change does to row-less accounts and the order floor, import, pin; the limitation that imports are not in the history. |
| Gates | `npm run typecheck`, `npm run lint` (ESLint and the language gate), billing tests (360 passed), `npm run build`; the example's `tsc --noEmit`; `billing-entitlements.spec.ts` (5 tests) against Postgres 16 with the built app. |

## Findings

None. No new gaps for the followups roadmap.
