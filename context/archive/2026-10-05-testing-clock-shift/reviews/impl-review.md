# Implementation review: testing-clock-shift

Scope: full · Date: 2026-10-05 · Gates: typecheck, lint, test, build (all green locally)

## Verdict

Ready. `@softure-ai/testing` shifts the test clock to `TEST_TODAY` through its `./vitest-setup` entry,
with 23 tests over the functions, the setup entry and fake timers.

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Plan coverage | PASS | package, functions, setup entry, README, core README, module standard §10 |
| Tests | PASS | `tests/shift-clock.test.ts` (20), `tests/vitest-setup.test.ts` (3); each restores the clock in `afterEach`, so random order holds |
| Correctness | PASS | noon local day; explicit `new Date(x)`, `Date.UTC`, `Date.parse` untouched; `instanceof` for real dates; a second shift replaces the first through the `Symbol.for` key; an impossible day (`2027-02-30`) is refused before `Date` is touched |
| Fake timers | PASS | measured and pinned: fake timers start from the shifted now, `vi.useRealTimers()` gives the shifted clock back |
| Repository shape | PASS | `packages.test.ts` (name, exports order, build, README), language gate, links |
| Release safety | PASS | `"private": true` until DP-8: `plan-tags.mjs all` still plans the 16 published packages and refuses `testing`, so an owner's release of "all" cannot publish 0.1.0 before DP-7 lands |

## Findings

- Fixed during review: lint flagged an unneeded cast in the constructor (`super(...args)`).
- Fixed during review: the package was public at first, which made "all" in `auto-release` include it
  (`release-tags.test.ts` went to 17). Marked private; DP-8 drops the flag at its first publish.
- Accepted: code that captured `Date` before the setup ran keeps the real clock (README, Limitations).
- Accepted: the database clock does not move (README); FIRE measured the same.
