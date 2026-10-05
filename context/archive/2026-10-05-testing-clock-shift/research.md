# Research: testing-clock-shift

Date: 2026-10-05

## Source

FIRE_TRACKER `vitest.shift-clock.ts` (read through the GitHub API, not changed): a setup file that,
when `TEST_TODAY` is set, checks `YYYY-MM-DD`, computes an offset to noon local time of that day and
replaces `globalThis.Date` with a subclass whose no-argument constructor and `now()` add the offset.
A `Proxy` keeps `Date()` (no `new`) working; `Symbol.hasInstance` keeps `instanceof Date` true for real
dates (made before the swap, by `fs.Stats`, by `structuredClone`). It warns on stderr when active.
Comments are Polish; the package copy is translated.

Generic as is. Gaps for a shared package:

- Format only (`/^\d{4}-\d{2}-\d{2}$/`): `2027-02-30` passes and becomes March 2.
- Not idempotent: loaded twice in one process it would stack two subclasses (still the right day, but
  `restore` would be impossible); a package needs a way back for its own tests.
- `Date.name` becomes `ShiftedDate`.

## How Vitest takes a setup file (measured, Vitest 5.0.3)

`setupFiles: ["@softure-ai/testing/vitest-setup"]` fails: `Cannot find module
'/home/claude/AI/@softure-ai/testing/vitest-setup'`. `setupFiles` are paths relative to the root, not
package specifiers. A one-line app file `import "@softure-ai/testing/vitest-setup";` listed in
`setupFiles` works and goes through Vite's resolver (export conditions included).

## With vi.useFakeTimers (the roadmap's unknown, measured)

Probe test under the setup with `TEST_TODAY=2027-01-02`:

| Step | `new Date()` |
| --- | --- |
| setup applied | Sat Jan 02 2027 12:00 (EST) |
| `vi.useFakeTimers()` | Sat Jan 02 2027 12:00: fake timers start from the shifted `Date.now()` |
| `vi.setSystemTime(2030-05-05)` | 2030-05-05T00:00Z: the test's own time wins |
| `vi.useRealTimers()` | Sat Jan 02 2027 12:00: the shifted `Date` is restored, not the real one |

So the two compose without code: fake timers install over whatever `Date` is global and put it back.

## Repository fit

- New package from `templates/package/` (`tests/repo/packages.test.ts` checks name, ESM, `exports`
  order, build script, README). Not a module (`foundation/`), so no `module.json` and no twelve
  sections. No hard-coded package lists in workflows or scripts (grep), so release and build pick it up.
- `@softure-ai/core` `Clock`/`systemClock` reads the global `Date`, so a shift also moves
  `systemClock`; modules keep the injected clock.
- The root `vitest.config.mts` is not wired to the setup here: the package's own tests compare `Date`
  with the real constructor, which a global shift would break; wiring the repository is not in the item.
