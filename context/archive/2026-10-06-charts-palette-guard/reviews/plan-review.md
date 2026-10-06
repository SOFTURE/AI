# Plan review: charts-palette-guard

Date: 2026-10-06 · Verdict: approved with two fixes applied

Checked against change.md, research.md, `foundation/charts/{package.json,styles.css,src/svg/class-names.ts,tests/*}`,
`foundation/ui/src/{theme/tokens.ts,testing/*}`, `scripts/release/release-rules.mjs` (internal ranges),
`scripts/build-workspaces.mjs` (build order), `examples/next-app/{package-lock.json,app/chart/page.tsx,e2e/chart.spec.ts}`
and the lessons on unseen-green tests.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The example app installs charts as a `file:` package and its lockfile records charts' dependencies (`@softure-ai/core` only). Moving `@softure-ai/ui` into charts' `dependencies` without refreshing that lockfile breaks `npm ci` in the e2e workflow. | Fixed: phase 1 refreshes `examples/next-app/package-lock.json` (`npm install` there after a build) and checks the charts entry lists `@softure-ai/ui`. |
| 2 | Warning | `primitives.test.tsx` asserts the wrap at three slots (`[1, 2, 3, 1, 2]`); phase 2 changes it, so the plan's "existing tests updated" must name it, or the change looks like a test bent to fit. | Fixed: phase 2 names the assertion and replaces it with the wrap at six (`[0..7]` → `[1..6, 1, 2]`). |
| 3 | Suggestion | A palette that only differs in lightness could pass the dichromat simulations. | Accepted as is: normal vision is one of the four views `findColorCollisions` checks (research §2), which is FIRE's anchor against that case. |
| 4 | Suggestion | `@softure-ai/ui` 0.1.6 is unpublished, so charts' `^0.1.6` runtime range only resolves in the workspace until CH-5. | Accepted as is: the devDependency already had that range, CH-5 publishes both, and `checkInternalRanges` only requires the workspace version to match. |

No missing phase. The build compiles all of `src/**`, so `dist/testing/` needs no tsconfig change;
`build-workspaces.mjs` already orders charts after ui (it reads devDependencies too). The e2e reads slot 1 from
`DEFAULT_THEME`, and slot 1 keeps its value. No migration.
