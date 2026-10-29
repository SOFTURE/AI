---
change_id: pwa-install-offer-873
title: "pwa: install offer for phones: kept beforeinstallprompt, iOS steps, a closable install bar (issue #873)"
status: in_progress
roadmap_item: null
issue: 873
branch: claude/project-thread-gdj3xi
created: 2026-10-29
updated: 2026-10-29
---

## Intent

Close [issue #873](https://github.com/SOFTURE/AI/issues/873): every installable app writes the same install offer
itself. `@softure-ai/pwa/react` gets the kept `beforeinstallprompt` store, the offer as a pure function, the device
facts, the per-device "closed" flag in `localStorage` and a `useInstallOffer()` hook; theme-notion gets the install
bar in its look.

## Context

Labels: `enhancement`, `pkg: pwa`. Follow-up of #872 (merged, e1852f4). #874 runs in parallel and also extends the
pwa exports; this change merges first. No release in this change: one batch release closes the wave.

## Constraints

- The listener is added when the client module loads, not in an effect (Chromium can fire before hydration).
- The server render shows no offer; a desktop never gets one.
- A blocked storage never throws into the page.
- Copy through the message dictionary; touch-target sizes; safe-area aware.
- English only in the repository.

## Notes

- Framing: skipped. The issue names the problem and the API.
