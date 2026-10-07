---
change_id: feature-switches-adoption-gaps
reviewed: implementation (phases 1-2)
date: 2026-10-07
verdict: approved with fixes applied
---

# Implementation review: feature-switches-adoption-gaps

Checked the diff against `plan.md`, issue #202 (items 1-5 and the closing note) and the module standard.

| Issue item | Delivered | Evidence |
| --- | --- | --- |
| 1. Panel inside an app shell | `toSwitchPanelRows`, `describeSwitchSource`, `getSwitchContext` from `/next`; README §4 composition | `tests/panel-rows.test.ts`; the README snippet typechecked as a scratch file against the package |
| 2. Privacy helpers | `{ db }` (`SwitchesPrivacyContext`), `ok({ clearedSwitches })`; contributor still `ok()` | `tests/privacy.test.ts` |
| 3. Adopting an existing table | README §5 checklist | `tests/adoption.test.ts` runs the README block as written with `baseline: { "feature-switches": 1 }`; without the primary key rename it fails; a scratch run without `DROP DEFAULT` failed too (`unexpected in database: column … default false`) |
| 4. Break-glass SQL | README §5 "Changing a switch from SQL" | doc only |
| 5. Revalidation | `setSwitchAction` revalidates `routes.panel` after a stored change | `tests/next-action.test.ts` (default and overridden route; none on refusal or unknown switch); red before the change |
| Note: Vitest inline | README §4 "Tests that import `/next`" | doc only |

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | `revalidatePath` ran inside the `try`: a throw there would report a stored change as failed. | Fixed: the revalidation runs after the `try`, once the value is stored. |
| 2 | Suggestion | `.returning({ name })` does not typecheck on the `Queryable` union. | Fixed: `.returning()` and its length; the table is small. |
| 3 | Suggestion | The README intro named the app the module came from. | Fixed: neutral wording. |
| 4 | Suggestion | `deleteSwitchesUserData`'s return value changed. | Recorded in the CHANGELOG as a change; no caller in the repository compares it. |

Gates: typecheck, lint (with the language gate), module tests (88 in feature-switches) and build green; the full
`npm test` runs in `pre-push`.
