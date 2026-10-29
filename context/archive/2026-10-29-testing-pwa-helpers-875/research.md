# Research: Playwright PWA helpers (issue #875)

## Current state

- `foundation/testing/src/playwright/`: one file per helper group, re-exported by `index.ts`; `@playwright/test`
  1.63 is an optional peer. Browser tests (`tests/playwright-browser.test.ts`) start a `node:http` server and launch
  Chromium from `tests/chromium.ts` (skipped without a browser, failing when a configured path is missing).
- README `## Playwright helpers` has an export table and examples.
- Theme tokens: `touch-target` 44 px (theme-notion), `touch` 44 px (theme-flat-paint).

## Probes (Chromium 153, headless, this container)

- `Emulation.setSafeAreaInsetsOverride({ insets: { top: 47, bottom: 34, left: 0, right: 0 } })` works: `env(safe-area-inset-*)`
  resolves to 47px and 34px with `viewport-fit=cover`.
- `Network.emulateNetworkConditions` and `Emulation.setCPUThrottlingRate({ rate: 4 })` work.
- `Emulation.setEmulatedMedia` does not accept `display-mode` (no effect on CSS or `matchMedia`), and Playwright's
  `emulateMedia` has no such option. What works in every browser: an init script that rewrites `display-mode`
  conditions of same-origin `CSSMediaRule`s and of `matchMedia` queries (`standalone` to an always-true
  `(min-width: 0px)`, any other value to the never-true `(max-width: -1px)`); checked that the rewritten rules apply.

## Network profiles (Chrome DevTools `NetworkManager`)

- Fast 4G: latency 60 × 2.75 = 165 ms, download 9 Mbit/s × 0.9, upload 1.5 Mbit/s × 0.9.
- Slow 4G: latency 150 × 3.75 = 562.5 ms, download 1.6 Mbit/s × 0.9, upload 750 kbit/s × 0.9.
- CDP throughput is in bytes per second. Lighthouse's mid-range phone slows the CPU 4×.

## Offline

`context.setOffline(true)` in Chromium also cuts the service worker's network, so a reload is answered by the cache
only. A page is controlled once `navigator.serviceWorker.controller` is set; the first visit may not be (no
`clients.claim()`), so the helper reloads once before giving up.
