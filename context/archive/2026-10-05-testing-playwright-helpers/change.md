---
change_id: testing-playwright-helpers
title: "Playwright helpers"
status: archived
roadmap_item: DP-7
branch: claude/project-thread-ll63l2
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

`@softure-ai/testing/playwright`: generic helpers for black-box Playwright tests of a SOFTURE app,
ported from FIRE_TRACKER `integration/infrastructure/*` and from the helpers the example app's e2e
repeats in every spec:

- a fresh client address per context (the example resolves clients from `CF-Connecting-IP`, so rate
  limit buckets never leak between tests);
- registration and login through the forms of `@softure-ai/auth`, named by auth's own copy;
- unique test data names and a `withDatabase` helper over a `@softure-ai/db` handle;
- the product select (`@softure-ai/ui` `Select`), polling `waitFor`, links that may leave the host,
  and assertions that say what was on the screen.

The example app's e2e moves to them where they fit.

## Context

Roadmap deploy, item DP-7 ([`backlog-input.md`](backlog-input.md)). Builds on DP-6 (the package and its
`./vitest-setup` entry). Source: FIRE_TRACKER `integration/infrastructure/*` (read only, copied and
translated), without `snapshot-form.ts`. PRD FR-35, FR-9.

## Constraints

- Owns: `foundation/testing/src/playwright/`, `foundation/testing/tests/playwright*`, the package's
  `package.json` and README; the example app's e2e specs and its `package.json`/lockfile entry.
- English only; the helpers have no user-facing copy (labels come from the module's own dictionaries).
- The package stays `"private": true` and 0.1.0 until DP-8 publishes it.
- No change to a published package: module-specific factories (an auth account created in SQL) are a
  follow-up for that module's own `testing` export, not this item.

## Notes

- Research done ([`research.md`](research.md)): FIRE's infrastructure read file by file, and the
  duplication across the example's specs counted.
- Framing skipped: the problem and the shape are given by the roadmap item and a working FIRE folder;
  the one open question (where factories live) is answered in research.
