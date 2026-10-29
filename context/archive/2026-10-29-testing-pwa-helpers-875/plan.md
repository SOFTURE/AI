---
change_id: testing-pwa-helpers-875
status: archived
---

# Plan: Playwright PWA helpers (issue #875)

Input: change.md, research.md. Complexity: medium (five helper groups, one browser test file, docs).

## Phase 1: helpers with browser tests (TDD)

Files in `foundation/testing/src/playwright/`, exported from `index.ts`; tests in
`foundation/testing/tests/playwright-pwa.test.ts` against a local server with a real service worker.

- `installed-app.ts`: `emulateInstalledApp(target)` (a `BrowserContext` or `Page`) adds an init script: iOS
  `navigator.standalone = true`, `matchMedia` and same-origin style sheets (`<style>`, `<link>`, added later too) read
  `display-mode` as `standalone`.
- `safe-area.ts`: `IPHONE_SAFE_AREA` (390 × 844, insets 47 / 34), `emulateSafeAreaInsets(page, insets)` (CDP),
  `expectClearOfSafeAreaInsets(controls, insets, { colorSchemes? })`: no visible element of the locator overlaps an
  inset band, checked in light and dark by default, failure lists each element and band.
- `phone.ts`: `PHONE_NETWORK_PROFILES` (`FAST_4G`, `SLOW_4G`), `PHONE_CPU_SLOWDOWN` (4),
  `throttleLikePhone(context, page, profile?, { cpuSlowdown? })` returns `{ release() }`;
  `expectLoadWithin(page, path, budgetMs, { event? })` opens the path, reads navigation timing, returns the measured ms.
- `offline.ts`: `expectWorksOffline(page, { path, answer, offlinePath?, timeout? })`: opens `path`, waits for a
  controlling worker (reloads once), goes offline, reloads (or opens `offlinePath`), expects `answer` visible, goes
  back online whatever happens.
- `touch-targets.ts`: `TOUCH_TARGET_PX` (44), `expectTouchTargets(scope, { minSize?, controls? })`: every visible
  tappable control is at least the size in both directions; failure lists each control with its size.
- CDP helpers throw `<helper> needs Chromium (CDP), got <browser>` on another browser.

## Phase 2: docs

`foundation/testing/README.md`: an "Installed app and phone checks" part with an installed-app spec and table rows;
`CHANGELOG.md` `## Unreleased`; package description mentions the PWA checks.

## Decisions (auto)

- `display-mode` through rewritten media rules, not CDP: Chromium's CDP does not emulate it (research), and the init
  script also works in WebKit and Firefox.
- One assertion per check returning nothing (or the measured time), matching `expectPageStatus` and friends.
- Only `FAST_4G` and `SLOW_4G`: the profiles the issue names; a custom profile object is accepted too.
- No version bump: the coordinator releases.

## Progress

- [x] Phase 1: helpers and browser tests
- [x] Phase 2: README and CHANGELOG
- [x] Implementation review: approved
