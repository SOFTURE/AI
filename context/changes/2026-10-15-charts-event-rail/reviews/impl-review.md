# Implementation review: charts-event-rail

Scope: full · Date: 2026-10-15 · Commits: 860f335..2a27ea0 · Gates: typecheck ✓ lint ✓ build ✓ test ✓ (charts 248)

## Verdict

Ready. The four asks of #508 are delivered behind `layout="rail"`; the #409 oracles pass unchanged, and a browser
render of a four-milestone rail (green segments ending in a red deadline dot, a narrow segment's label hidden by
`minLabelWidth`, years under the dots) matched the intent.

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Correctness | PASS | - |
| Backwards compatibility | PASS | D1 deviation below |
| Accessibility | PASS | W1 of the plan review handled in the README |
| Styling and tokens | PASS | - |
| Tests | PASS | - |
| Docs | PASS | - |

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1 | 860f335 | yes | D1 changed: overloads instead of a props union (below) |
| 2 | 2a27ea0 | yes | - |

Files: planned and changed 8 · unplanned 0 · planned, not changed 0.

## Findings

### W1 [WARNING] A props union changes `EventAxisProps` and `Parameters<typeof EventAxis>[0]`
**Impact:** MEDIUM · **Dimension:** Backwards compatibility · **Where:** `foundation/charts/src/cursor/event-axis.tsx`
**What:** with D1's union, the #409 test's helper typed `Partial<Parameters<typeof EventAxis>[0]>` stopped compiling;
an app typing its own wrapper the same way would break too.
**Fix:** `EventAxisProps` keeps its meaning (the default layout), `EventAxisRailProps` is new, and `EventAxis` has two
overloads with the default one last, so `Parameters<typeof EventAxis>[0]` is still `EventAxisProps`.
**Decision:** fixed in 860f335.

## Progress audit

Both phases ticked with their SHAs; `change.md` status `implemented` → `impl_reviewed`.

## Triage summary

Fixed: W1. Accepted: -. Deferred: -. Dismissed: -.

## Lessons proposed

None.

## Decisions (auto)

- Overloads over a props union (W1).
- `minLabelWidth` defaults to 0 (every label shows); no neutral track before the first or after the last milestone; a
  segment activates the milestone it leads to (plan D3–D5).
