---
change_id: testing-pwa-helpers-875
title: "testing: Playwright helpers for installed-app and phone checks (issue #875)"
status: archived
roadmap_item: null
issue: 875
branch: claude/project-thread-0jg63x
created: 2026-10-29
updated: 2026-10-29
archived_at: 2026-10-29
---

## Intent

Close [issue #875](https://github.com/SOFTURE/AI/issues/875): `@softure-ai/testing/playwright` gets the checks every
installable app needs, which an adopting app wrote for itself: an installed-app emulation (`navigator.standalone` and
`display-mode: standalone`), safe-area insets over CDP with an overlap assertion, phone network and CPU profiles with a
load budget assertion, an offline check after the service worker took control, and a touch target assertion.

## Context

Labels: `enhancement`, `pkg: testing`. Part of a wave; no version bump, the coordinator releases the batch.

## Constraints

- Additive only: no existing export changes.
- CDP helpers are Chromium only and fail with a message that says so on another browser.
- Browser tests run in Vitest against a local server, like `tests/playwright-browser.test.ts`.

## Notes

- Framing: skipped. The issue names the problem and the proposal.
