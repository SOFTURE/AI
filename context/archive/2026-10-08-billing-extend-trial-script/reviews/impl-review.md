# Implementation review: billing-extend-trial-script

Reviewed: the branch diff against plan.md, change.md and issue #243. Verdict: **approve after fixes** (applied).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `--days` counted from the current end's calendar day. For an end in the middle of a day (an imported trial, a row written by another system) that day is already a day of access, so `+N` gave only `N - 1` more days. | Fixed: the new last day is `N` days after the later of yesterday and the current last day; new test with a 14:00 trial end, seen red against the old formula. Plan, README and CHANGELOG reworded. |
| 2 | Suggestion | `describeTrial` read the entitlement record twice (`findEntitlementRecord`, then `getEntitlement` reading it again). | Fixed: resolves the entitlement from the one record. |
| 3 | Suggestion | A direct `executeOpsScript` caller may pass both `email` and `user`; `email` wins silently. | Kept: the type documents that `runOpsScript`'s schema enforces exactly one, as for the other billing scripts; tests cover the command path. |
| 4 | Check | Refusals come from `extendTrialManually` (no rule duplicated); refusals write nothing, the pinned row included (test). | No change. |
| 5 | Check | Output never prints the email (test on the command); reports carry the user id. | No change. |
| 6 | Check | `lead` defaults to none, both pages, red without the render (verified). Example app has the script, a README row and an e2e test against the built app. | No change. |
| 8 | Critical | Found by the example app's e2e run on the PR: on a real clock, `extendTrialManually` read the time once for the update and `pinEntitlementRow` read it again (later) for the pinned row's `created_at`, so the update set `updated_at` before `created_at` and the database refused it. Present since 0.1.8 for the admin form too; unit tests missed it because their clock stands still. | Fixed: `pinEntitlementRow` takes the change's `now` (trial extension and manual grant); a test with a clock that moves on every read, red before the fix. |
| 7 | Check | Versions: package, module manifest, `src/index.ts`, lockfile at 0.1.9; CHANGELOG entry. | No change. |

Drift from plan: finding 1 (amended in plan.md); the example app's script and e2e test were added beyond the plan's
file list, following how every other billing script is shown there.
