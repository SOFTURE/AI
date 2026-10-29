---
change_id: pwa-install-offer-873
status: archived
---

# Plan: the install offer (issue #873)

Input: change.md, research.md. Complexity: medium (one new page-side feature, one theme part).

## Phase 1: the pure parts (TDD)

- `src/react/install-offer.ts`: `pickInstallOffer({ isIos, isPhone, isInstalled, isClosed, hasPrompt })` →
  `"ios_steps" | "browser_prompt" | "none"`.
- `src/react/device.ts`: `isIosDevice(nav)`, `isPhoneDevice(nav)`, `isInstalledApp(win)`, the browser's globals by
  default.
- `src/react/install-offer-storage.ts`: `getInstallOfferKey(app)`, `isInstallOfferClosed(key, getStorage)`,
  `rememberInstallOfferClosed(key, getStorage)` (answers whether the flag was kept).

## Phase 2: the store and the hook (TDD)

- `src/react/install-prompt.ts`: `createInstallPromptStore(target)` (keeps the event with `preventDefault`, forgets it
  on `appinstalled`, `subscribe`, `getSnapshot`, `getServerSnapshot` → `null`, `open()` uses it once and answers
  whether the sheet opened); `installPromptStore`, created on module load in a browser; `openInstallPrompt()`.
- `src/react/use-install-offer.ts`: `useInstallOffer({ app, store })` → `{ offer, install, close }`.
- Export all from `src/react/index.ts`; the copy `pwaMessages.en.install`.

## Phase 3: theme-notion `InstallBar`

A floating `Alert` like `UpdatePrompt`: the install `Button` for `browser_prompt`, the two iOS steps (Share, then
"Add to Home Screen") for `ios_steps`, nothing for `none`; a close `Button` (`icon-touch`, `md:size-7`) labelled by the
app's copy. Export, README, isolated gallery case, parity fixture, visual baselines, CHANGELOG.

## Phase 4: docs

pwa README (§1, §4 mounting, §9 copy, §10, §12) and CHANGELOG.

## Decisions (auto)

- An iOS device gets the steps whether `isPhone` says so or not: an iPad reporting a Mac user agent is not a phone by
  user agent, but it installs the same way and is not a desktop. A browser prompt goes to phones only.
- The storage key is `<app>:pwa-install-closed`, with the app id from the hook's `app` option (the same id as
  `createServiceWorkerRoute`); the id is checked with the same pattern.
- `open()` resolves `true` once `prompt()` resolved, without waiting for the user's choice: the question is whether the
  sheet opened. A spent or missing event answers `false`.
- The bar is a polite `status`, like `UpdatePrompt`; the offer type is a string union in theme-notion (no dependency
  on the pwa package).
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: the pure parts, d08424c
- [x] Phase 2: the store and the hook, d08424c
- [x] Phase 3: theme-notion InstallBar, 4c91820 (two isolated gallery cases: no full-page baseline moves)
- [x] Phase 4: docs, e3ce85e
- [x] Implementation review: approved
