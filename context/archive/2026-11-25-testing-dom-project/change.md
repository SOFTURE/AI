---
change_id: testing-dom-project
title: "testing: an opt-in DOM project in the Vitest preset for component interaction tests (issue #1487)"
status: archived
roadmap_item: null
issue: 1487
branch: claude/project-thread-5pmwpu
created: 2026-11-25
updated: 2026-11-25
archived_at: 2026-11-25
---

## Intent
An adopting app unit tests an interactive component (a menu opened with Enter, moved with the arrow keys, closed with
Escape; where focus goes afterwards) next to its other Vitest tests, without building a DOM test stack of its own and
without moving the check into the Playwright e2e. Issue #1487 (`enhancement`, `testing`, `pkg: testing`).

## Context
`softureVitestConfig()` runs every test in node and the package has no DOM setup, so an app can only pin markup with
`renderToStaticMarkup`. This repository already tests components in happy-dom with `@testing-library/react` (a
`@vitest-environment happy-dom` docblock per file), so the stack is known to work with the packages.

## Scope
- `softureVitestConfig({ dom: true })`: two Vitest projects, `node` (every test except `*.dom.test.*`) and `dom`
  (only `*.dom.test.*`, in happy-dom, with a DOM setup file that unmounts after each test).
- `@softure-ai/testing/vitest-dom-setup` (the setup file) and `@softure-ai/testing/dom` (`renderWithUser`: render
  plus a `user-event` instance).
- Optional peers `happy-dom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`.
- Tests (config shape, a Vitest run of an app with a keyboard-driven menu and a node test), README, CHANGELOG
  `Unreleased`.
- Out of scope: keyboard tests of theme-notion's primitives (a parallel change works on theme-notion); the adopting app.

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: a reported gap with a proposed shape in the issue.

## Done
`softureVitestConfig({ dom: true })`: a `dom` project runs `*.dom.test.*` files in happy-dom with a setup file that
unmounts after each test, a `node` project runs every other test. `@softure-ai/testing/dom` adds `renderWithUser`
(`render` plus `userEvent.setup()`). Optional peers `happy-dom`, `@testing-library/react`, `@testing-library/dom`,
`@testing-library/user-event`. Tests (project shape, a Vitest run of a keyboard-driven menu), README, CHANGELOG
`Unreleased`; ships in the next testing release. An adopting app moves its menu keyboard checks from the e2e into
`*.dom.test.tsx` files.
