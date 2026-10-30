---
change_id: pwa-launch-screen-911
---

# Research: PWA launch screen (issue #911)

## What exists

- `modules/pwa`: manifest, icon registry (`PWA_ICONS`, `getIconPath`), worker as one self-contained function
  (`serviceWorker`, shipped as its text by `buildServiceWorkerSource`, tested in Node with `FakeWorkerScope` and from
  its compiled text in `tests/built-worker.test.ts`), copy in `pwaMessages.en` (`update`, `install`).
- README §8: "The package draws nothing on the page". `UpdatePrompt` and `InstallBar` live in
  `themes/theme-notion/src/notion/` and take the copy as props; theme-notion does not depend on pwa.
- theme-notion `Progress` (Radix): root `data-slot="progress"` with `role="progressbar"`, `aria-valuenow`,
  `aria-valuetext`; indicator `data-slot="progress-indicator"` moved by `transform: translateX(-<100-v>%)`.
- New compositions need: an export from `src/index.ts`, a README mention (inventory test), a gallery case
  (`tests/gallery/cases.tsx`), a parity fixture entry (`UPDATE_FIXTURES=1`) and visual baselines.
- The worker's `navigate` keeps every whole 200 HTML answer (`isWholeAnswer`). With a streamed shell, Next answers a
  `redirect()` in the page with 200 and `<meta id="__next-page-redirect" http-equiv="refresh">`, and a thrown error
  with React's client-render instruction (`$RX=function(` plus `$RX("B:0", …)`).
- A script inside a server-streamed Suspense fallback runs when the browser parses it; React does not run a
  `<script>` it inserts on the client, so on a client-side navigation the counter stays at its first value.

## Options

1. `LaunchScreen` in theme-notion (props: `name`, `iconSrc`, `label`, `script`), the counter script builder and copy
   in pwa. Chosen: follows the package split (pwa draws nothing, the theme draws). The script and the component meet
   on `data-slot` names, documented and tested on both sides.
2. `LaunchScreen` in pwa, importing theme-notion's `Progress`. Rejected: a pwa → theme-notion dependency and a
   second place that draws.
3. iOS `apple-touch-startup-image`: one PNG per device size and orientation (about 20), drawn per theme. Left out:
   the launch screen covers the time from the first byte; recorded in the README's limitations.
