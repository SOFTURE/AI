---
change_id: pwa-install-offer-873
---

# Research: the install offer (issue #873)

## What exists

- `modules/pwa/src/react/` (#872): `useIsOnline` (a `useSyncExternalStore` over window events with a server
  snapshot), `watchServiceWorker` (headless, every browser dependency injectable) and `useServiceWorkerUpdate`.
  Tests run under `// @vitest-environment happy-dom` (`tests/hooks.test.tsx`).
- `pwaMessages.en.update` holds the update prompt's copy; `UpdatePrompt` in theme-notion takes it as props, keyed the
  same, and is an isolated gallery case (its own visual page), so the full-page baselines do not move.
- theme-notion: `Alert`, `Button` sizes `touch` and `icon-touch` (the `touch-target` token), `ICON_STROKE_WIDTH`, the
  inventory test (exports, README list, gallery agree), the parity fixture (`UPDATE_FIXTURES=1`) and the visual
  baselines (`--update-snapshots`).
- `createServiceWorkerRoute({ app })` already names the app id (lowercase letters, digits, dashes); the storage key
  takes the same id.

## Platform facts

- Chromium fires `beforeinstallprompt` once the manifest qualifies; `preventDefault()` stops its mini bar and the
  event's `prompt()` can be called once, after which the event is spent. `appinstalled` fires after an install.
- iOS Safari has no install prompt: Share, then "Add to Home Screen". iPadOS reports a Mac user agent by default;
  `navigator.maxTouchPoints > 1` tells it from a Mac.
- `navigator.userAgentData.mobile` (Chromium) is the reliable phone flag where it exists; elsewhere `Mobi|Android`.
- Installed: `matchMedia("(display-mode: standalone)")` or iOS `navigator.standalone === true`.
- `localStorage` access itself can throw (blocked storage, sandboxed frame); a write can throw (quota, private mode).

## Options

1. The store as a factory over an event target (`createInstallPromptStore(target)`) plus one module-level instance
   created when `@softure-ai/pwa/react` loads in a browser; the hook reads the instance by default and takes another
   for tests. Chosen: the listener exists before hydration, and tests need no module reloads.
2. A listener added in the hook's effect. Rejected: the event usually fires before hydration and is lost.
3. The bar inside the pwa package with slots. Rejected: the theme packages own the look (#872 put `UpdatePrompt` in
   theme-notion for the same reason).

## Risks

- `sideEffects: false` on the package: a bundler may drop the module when nothing from it is imported, which is the
  right outcome (no offer used, no listener). When the hook or store is imported, the module and its listener stay.
- Hydration: device facts and the storage flag are read after mount, so the server render and the first client
  render agree (no offer).
