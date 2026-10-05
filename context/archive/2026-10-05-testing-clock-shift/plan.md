# Plan: testing-clock-shift

Input: change.md, research.md. Complexity: small (one phase).

## Goal

`@softure-ai/testing` exists in `foundation/testing/` with a `./vitest-setup` entry that shifts the
clock to `TEST_TODAY`, the functions behind it in `.`, tests for both, and docs next to core's clock.

**Out of scope:** Playwright helpers (DP-7), publishing (DP-8), wiring this repository's own Vitest
config, a database clock shift.

## Approach

**Chosen:** copy FIRE's mechanism (offset subclass, `Proxy` for `Date()`, `Symbol.hasInstance`) into
`src/vitest/shift-clock.ts` as functions (`readTestToday`, `shiftClock`, `restoreClock`,
`isClockShifted`), with the real `Date` kept under a `Symbol.for` key on `globalThis` so a second shift
replaces the first and a restore always reaches the real constructor. `src/vitest/setup.ts` is the
side-effect entry: reads `TEST_TODAY`, shifts, warns. Fixes over FIRE: real-calendar validation and
`Date.name`. A malformed value throws a `RangeError` (a configuration bug: the run must not continue on
the real date).

**Rejected:** `vi.useFakeTimers({ toFake: ["Date"] })` or `vi.setSystemTime` in the setup: they freeze
time and are reset by any test that uses fake timers itself. A "fixed default day" baked into the setup
entry: it would shift every run of every app; an app gets it with three lines of its own (README).

## Phase 1: Package, tests, docs

**Discipline:** TDD for the functions; the setup entry is tested by importing it under stubbed env.
**Files:** `foundation/testing/**`, `package-lock.json` (workspace link), `foundation/core/README.md`,
`docs/02-module-standard.md`.

1. Scaffold from `templates/package/` (package.json, tsconfigs, README; no module.json, messages or
   migrations).
2. Tests: `readTestToday` (unset, empty, valid, malformed, impossible days); `shiftClock` (now, `Date()`,
   noon local day, time keeps running, explicit values and statics unchanged, `instanceof`, re-shift,
   invalid day leaves clock real); `restoreClock`/`isClockShifted`; fake timers both ways; setup entry
   with, without and with a malformed `TEST_TODAY`.
3. Implement `shift-clock.ts`, `setup.ts`, `index.ts`.
4. Docs: package README (setup, behaviour, fake timers, database clock, API); a paragraph in core's
   README "Time"; a bullet in the module standard §10.
5. Gates: typecheck, lint, test, build.

## Progress

- [x] Phase 1: package, tests, docs (commit in this change's merge)
