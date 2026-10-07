---
change_id: feature-switches-adoption-gaps
reviewed: plan.md
date: 2026-10-07
verdict: approved with fixes applied
---

# Plan review: feature-switches-adoption-gaps

Checked `plan.md` against `change.md`, issue #202, the module sources it names, core's `PrivacyContributor`, the
db baseline comparison and the billing and mcp-access actions that already revalidate.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The issue's item 1 offers two remedies; the plan picks only the exported mapping. An app also needs the undefined-manifest report and the role check to rebuild the page. | Accepted: both are already public (`listUndefinedManifestSwitches` from `/server`, `requireRole` from auth); README §4 shows the full composition so nothing is copied. |
| 2 | Warning | `deleteSwitchesUserData`'s new return value is not assignable to `PrivacyContributor.deleteUserData`. | Already in the plan: the contributor wraps the helper and returns `ok()`; a test asserts it. |
| 3 | Warning | A revalidation test needs request scope: `authorizeRole` reads the session cookie through `next/headers`. | Accepted: the action test mocks `next/headers` and `next/cache` (billing's pattern) and registers the real config with `database.handle` on the test PGlite, so the real role check and store run. |
| 4 | Suggestion | The adoption test should prove the checklist is needed, not only sufficient. | Already in the plan: the same hook without the constraint rename must fail the baseline comparison. |
| 5 | Suggestion | The README intro names the app the module came from. | Accepted: rewritten neutrally in phase 2. |
| 6 | Suggestion | Typing the mapping's `config` as `Pick<SoftureConfig, "locale" \| "timezone">` keeps a full config assignable. | No change needed. |

No finding blocks the plan.
