---
change_id: billing-free-tier-962
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and the issue's four asks.

- Ask 1: `free: { limits }` parses as optional; `resolveEntitlement` falls back to `free` with `hasFreeTier`, and the
  guards pass it unchanged (`status !== "read_only"`). Tested pure and through `checkWriteAccess` on PGlite.
- Ask 2: `consumeUsage` keeps `billing.quota_exhausted` and adds `upgradePlanIds` (pure rule `findUpgradePlanIds`,
  tested with a null limit, paid.limits fallback and no raising plan).
- Ask 3: badge kind `free`, neutral notice, free copy for ending notices and all four mails; the admin page shows
  the badge. The reminder windows are unchanged; tested.
- Ask 4: migration 0013 with defaults, equivalence test under two free-tier policies, a test of the 0012 call shape;
  `setTestEntitlementState({ status: "free" })`.
- Deviation from the plan: `afterEnd` is optional and set only with a free tier, so an app without one gets the very
  same objects (its `toEqual` tests keep passing). Recorded in the CHANGELOG.
- Fixed in review: three file headers re-wrapped to the file's width.

Gates: typecheck, ESLint and the language gate clean; billing 727 tests (716 passed, 11 skipped as before), repo
tests green.

Verdict: approved.
