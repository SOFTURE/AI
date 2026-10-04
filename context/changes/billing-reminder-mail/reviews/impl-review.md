# Implementation review: billing-reminder-mail

Scope: full · Date: 2026-10-04 · Commits: eaa4135..fb41475 · Gates: typecheck ✓ lint ✓ test ✓ (2413 tests at p2; repo and billing suites, 467 tests, re-run after p3 and the fix) · e2e ✓ (86 + the new spec; the new spec and the ledger re-run after its fix)

## Verdict

Ready. The three phases deliver the plan: a pure rule, a bounded read with an index, the sender in
an optional `/mailing` entry, and the example's script with an e2e. One documentation gap (GDPR) was
fixed; one behaviour the notice shares is accepted.

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | ✓ | - |
| Progress honesty | ✓ | - |
| Correctness | ✓ | F2 |
| Tests | ✓ | - |
| Migrations | ✓ | - |
| Security | ✓ | - |
| Patterns and lessons | ✓ | - |
| Documentation | ✓ after fix | F1 |

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1 Which accounts are due a reminder | a9cccf2 | `getAccessReminder`, `getAccessReminderScope` (root), `findAccessReminders` (`/server`), auth `0004` index | as planned |
| 2 The reminder mail through mailing | b1d1452 | `@softure-ai/billing/mailing` (`sendAccessReminders`, `renderAccessReminderMail`), copy `en`/`pl`, optional peer, README | lockfile hunk limited to billing's peers (an unrelated `npm install` churn was dropped) |
| 3 Example app script and e2e | 8fa0a35 | `scripts/send-access-reminders.ts`, `npm run access-reminders`, `e2e/billing-reminders.spec.ts`, ledger line | the spec moves the account's creation back before ending the trial (see Evidence under F2) |

Files: planned and changed 26 · unplanned 0 · planned, not changed 0 (no tsconfig change was needed).

## Findings

### F1 [WARNING] The GDPR section did not say where reminder mail is recorded
**Impact:** LOW (obvious, narrow fix) · **Dimension:** Documentation · **Where:** `modules/billing/README.md` §11
**What:** the scope in `mailing.deliveries` names the account id; mailing keeps that ledger after an
account is deleted (`modules/mailing/README.md` §11), and billing's GDPR section was silent about it.
**Why it matters:** the README is the controller's map of personal data.
**Fix:** one bullet in §11.
**Decision:** fix now: bullet "Reminder mail" added (fb41475).

### F2 [SUGGESTION] A paid period that ends inside a longer trial gets a "renew" mail
**Impact:** LOW · **Dimension:** Correctness · **Where:** `modules/billing/src/reminder.ts`
**What:** `resolveEntitlement` reports `paid` while a dated grant runs, so a raw `grant { until }`
inside a running trial yields `paid-ending`, although the trial continues after it.
**Why it matters:** only reachable through a hand-applied grant (plans start where access ends);
the in-app notice says the same, so mail and notice agree.
**Evidence:** the first e2e run showed the related guard working as designed: a trial ended before
the account's creation is "no trial" and gets no mail; the spec now ages the account first.
**Decision:** accept (auto): consistent with the notice; changing it belongs to the state machine, not this change.

## Progress audit

All eight Automated items are ticked with evidence: 1.1 `tests/reminder.test.ts` and
`tests/reminders.test.ts` (brute-force cross-check over 40 accounts and 50 instants, more than 100
reminders found); 1.2 the `pg_indexes` assertion in `reminders.test.ts`; 2.1
`tests/reminder-mail.test.ts` (11 cases, overlap included); 2.2 `npm run build` produced
`dist/mailing/` and `tests/repo/packages.test.ts` passed; 3.1 Playwright run above; 1.3, 2.3, 3.2
gate runs in this session. Mutation checks: `>` → `>=` in the catch-up rule turned 2 tests red; a
row-less upper bound one day short turned the brute-force check red. Manual 3.3 is this report.

## Triage summary

Fixed: F1. Accepted: F2. Deferred: -. Withdrawn: -.

## Lessons proposed

None.

## Decisions (auto)

- F1 GDPR section → fix now (clear local fix).
- F2 paid-ending inside a trial → accept (matches the notice; a state machine change is out of scope).
