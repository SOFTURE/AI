---
change_id: testing-pwa-helpers-875
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and the acceptance of #875.

- Installed app: `emulateInstalledApp` sets `navigator.standalone` and rewrites `display-mode` in `matchMedia`, inline,
  linked, nested (`@supports`) and late style sheets; a page without it keeps the browser display mode. Tested.
- Safe area: `emulateSafeAreaInsets` resolves `env(safe-area-inset-top)` to 47px on `IPHONE_SAFE_AREA`;
  `expectClearOfSafeAreaInsets` passes clear bars and names each overlapping control with band and scheme, catching a
  control that only shows in dark; the scheme is reset after. Tested.
- Phone: profiles pinned to the DevTools numbers; `throttleLikePhone` slows a load past the profile's latency,
  `expectLoadWithin` fails over budget with path, time and budget, `release()` restores speed; a page of another
  context is refused. Tested.
- Offline: kept page reload, offline page for an unvisited path after the extra reload for a non-claiming worker, a
  page without a worker fails within the timeout naming the path, the context is online again after a failed answer.
  Tested.
- Touch targets: passes 44 px and larger, lists smaller controls with sizes, skips hidden ones, `controls` and
  `minSize` override. Tested.
- Deviation from plan: the two list assertions throw an `Error` with one line per finding instead of `expect(...).toEqual([])`,
  whose diff escaped the quotes and buried the list.
- Docs: README section with an installed-app spec and the table; CHANGELOG `## Unreleased`; no version bump.

Gates: typecheck and lint green (ESLint needs a larger heap in this container: `NODE_OPTIONS=--max-old-space-size=8192`);
`tests/playwright-pwa.test.ts` 11 passed; full `npm test` on the pre-push hook.

Verdict: approved.
