# Plan review: billing-reminder-mail

Reviewed: plan.md @ 2026-10-04. Mode: deep. Verdict: ready after fixes.
Findings: 0 critical, 2 warning, 2 suggestion.
Grounding: 14/14 paths, 11/11 symbols (`resolveEntitlement`, `getDefaultRecord`, `getTrialEnd`, `getStartOfDay`, `getDayNumber`, `formatLastDay`, `deliverOnce`, `fakeMailProvider`, `readMailOutbox`, `createDatabase`, `systemClock`), 4/4 commands (`workflow.json` gates, `npm run build`, `npm run e2e`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS |
| Slicing | PASS |
| Verifiability | PASS |
| Data and migrations | WARN (W1) |
| Tests | WARN (W2) |
| Security | PASS |
| Lean | PASS |
| Fit | PASS (S1) |
| Cost and defaults | PASS |
| Scope | PASS |
| Reuse | PASS |
| Lessons | PASS |
| Progress format | PASS |

Verified claims (deep): the build order script follows `peerDependencies` too
(`scripts/build-workspaces.mjs:39`), so billing builds after mailing with an optional peer; the
package shape test only requires source → types → default per entry (`tests/repo/packages.test.ts:97`);
`fakeMailProvider` writes the outbox file outside production (`modules/mailing/src/testing/fake-provider.ts:45-59`);
the example runs `.ts` scripts with Node's type stripping (`examples/next-app/package.json`, `grant-role`).
Blast radius: `auth 3 create_password_resets` is listed in `e2e/migrations.spec.ts:11`,
`modules/auth/README.md:269` and the header of `modules/auth/src/schema.ts:1-3`; nothing else
consumes billing's root or `/server` exports that this plan changes (only additions).

## Findings

### W1 [WARNING] The auth index lands in three documents the plan names only partly
**Effort:** low. **Lens:** Data and migrations. **Where:** Phase 1, step 2 · `modules/auth/src/schema.ts:1-3`, `modules/auth/README.md:269`
**Problem:** the plan updates the auth README "migrations section" but not the schema header that
lists every migration, so the next reader of `schema.ts` misses `0004`.
**Fix:** step 2 also updates the header comment of `modules/auth/src/schema.ts`; the README line
269 names `0004_index_users_created_at.sql`.
**Decision:** Fix now (applied) - step 2 names both files.

### W2 [WARNING] No test proves two overlapping runs send one mail
**Effort:** low. **Lens:** Tests. **Where:** Phase 2, Tests
**Problem:** "also when runs overlap" is in the Goal; mailing's own tests cover `in-flight`, but
nothing proves billing's scope makes two concurrent `sendAccessReminders` calls agree.
**Fix:** add a case running two `sendAccessReminders` at once (`Promise.all`) on the same database
and asserting one mail in the fake provider and `sent + skipped` summing to the due count twice.
**Decision:** Fix now (applied) - added to Phase 2 Tests.

### S1 [SUGGESTION] Keep the pure rule's input small
**Effort:** low. **Lens:** Fit. **Where:** Phase 1, step 1
**Problem:** `getAccessReminder` takes `policy` and the record; passing the already resolved
`Entitlement` would split the decision across two calls in every caller.
**Fix:** keep it as planned (record in, decision out); it is the one place the rule lives.
**Decision:** Dismiss - the plan's shape is already the better one; recorded for the implementer.

### S2 [SUGGESTION] Name the summary fields after mailing's outcomes
**Effort:** low. **Lens:** Fit. **Where:** Phase 2, step 2
**Problem:** `skipped` folds `done` and `in-flight`; an operator reading the script's line cannot
tell "already sent" from "another run is sending".
**Fix:** keep `skipped` (both mean "not this run's to send") and document it in the README.
**Decision:** Fix now (applied) - README step mentions what `skipped` counts.

## Triage summary
Fixed: W1, W2, S2. Accepted: -. Deferred: -. Dismissed: S1. Verdict after triage: ready after fixes.

## Decisions (auto)
- W1 auth index documents → Fix now (low effort, clear fix).
- W2 overlapping runs test → Fix now (Goal promise needs a test).
- S1 pure rule input → Dismiss (the plan's shape is already the better one).
- S2 summary naming → Fix now (cheap README line).
