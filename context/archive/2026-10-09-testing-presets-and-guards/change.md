---
change_id: testing-presets-and-guards
title: "testing: a per-test client address in Playwright's test, Vitest and Playwright presets, and source guards (issue #326)"
status: archived
roadmap_item: null
issue: 326
branch: claude/project-thread-683r9u
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Apps and packages copy the same test plumbing ([#326](https://github.com/SOFTURE/AI/issues/326)):

1. A `beforeEach` that sends a random client address, so `@softure-ai/security` rate limit buckets do not leak
   between tests. After this change `test`/`expect` from `@softure-ai/testing/playwright` do it per test, for
   `page`, `context` and `request`.
2. About 40 lines of Vitest config per Next.js app. After it, `softureVitestConfig()` returns them.
3. Host blocking and `PLAYWRIGHT_CHROMIUM_PATH` in `playwright.config.ts`. After it, `softurePlaywrightUse()`.
4. A JSX text collector re-implemented in ten package architecture tests. After it, `@softure-ai/testing/guards`
   holds it (plus a forbidden-phrase guard for an app's product vocabulary), and the package tests use it.

A reviewer checks `foundation/testing/src/{guards,playwright/test.ts,playwright/preset.ts,vitest/preset.ts}`, their
tests, the twelve rewritten `tests/architecture.test.ts` files, the example app's Playwright configs, the README,
the CHANGELOG and the version bump (testing 0.1.4).

## Context

- `@softure-ai/testing` 0.1.3 is on npm; nothing unreleased on master.
- `@softure-ai/config`'s ESLint preset already has the `fixtures` rule that forces `test` from a module.

## Constraints

- No package's guard gets weaker: each rewritten architecture test must still pass and check at least the same files.
- The clock-only use of the package must not need `typescript`, `vitest` types at runtime or `@playwright/test`.

## Notes

- `research` skipped: the issue lists the four pieces and the files they replace; the code read is in the plan.
- `frame` skipped: the problem (copied plumbing) is not in doubt.
