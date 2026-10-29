---
change_id: pwa-install-offer-873
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (e1852f4).

- Acceptance of #873, item by item: the kept prompt store on module load with `preventDefault`, forgotten on
  `appinstalled`, a `useSyncExternalStore` store with a `null` server snapshot, `openInstallPrompt()` (phase 2); the
  pure `pickInstallOffer`, desktop never offered (phase 1); the device facts incl. the iPad with a Mac user agent and
  both installed checks (phase 1); the per-device flag read and written safely (phase 1); the bar with the prompt
  button or the iOS steps, a close button, copy through messages, touch sizes and safe area (phase 3); the storage
  key prefixed by the app id (phase 1, decision).
- The iPad decision widens "phone" for iOS only and keeps desktops out; recorded with its reason.
- Hydration safety: facts read after mount, server snapshot `null`.
- Overlap with #874: both add exports to `src/react/index.ts` and lines to the README and CHANGELOG; this change merges
  first, #874 resolves the list.

Verdict: approved, no changes.
