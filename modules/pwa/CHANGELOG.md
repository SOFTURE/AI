# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/pwa`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## 0.1.0

- Clearing the device on sign-out (#874): `registerDeviceData({ caches, indexedDb, storageKeys })` for the app and its
  modules, and `clearDeviceData()`, which clears every registered part and the worker's kept pages, tries every part
  even when another fails, skips a missing API and returns the failed part names. `LogoutForm` of
  `@softure-ai/auth/ui` runs it as `beforeSignOut`.
- The install offer for phones (#873), in `@softure-ai/pwa/react`: `installPromptStore` keeps Chromium's
  `beforeinstallprompt` from the moment the module loads (`preventDefault()` stops the mini bar, `appinstalled` forgets
  it), `openInstallPrompt()` uses it once; `pickInstallOffer` (`ios_steps`, `browser_prompt`, `none`; never on a
  desktop or in the installed app); `isIosDevice` (an iPad with a Mac user agent too), `isPhoneDevice`,
  `isInstalledApp`; the closed flag per device under `<app>:pwa-install-closed` (`getInstallOfferKey`,
  `isInstallOfferClosed`, `rememberInstallOfferClosed`), safe with a blocked storage; `useInstallOffer({ app })` →
  `{ offer, install, close }`. Copy `pwaMessages.en.install`; the bar is theme-notion's `InstallBar`.
- First version (#872): an installable app that works offline. One public prefix `/pwa/` for what a phone's installer
  fetches without cookies; the web app manifest from the theme's token values and the app's copy
  (`createManifestRoute`); the icon registry (`icon-32`, `apple-icon-180`, `icon-192`, `icon-512`,
  `icon-maskable-512`), its route on theme-kit's `drawAppIcon` (`createIconRoute`) and the head's links
  (`getIconMetadata`); the service worker served at `/sw.js` from one Node-testable function
  (`createServiceWorkerRoute`, `@softure-ai/pwa/worker`): build-named caches, network-first navigations with a 5 s
  timeout, kept pages (60, least recently kept dropped), an offline page, excluded prefixes, extra origins in their
  own cache, `skip-waiting` and `clear-pages` messages; the new-build update flow on the page (`watchServiceWorker`,
  `useServiceWorkerUpdate`); the build version (`getBuildVersion`, `/pwa/version`); `useIsOnline`.
