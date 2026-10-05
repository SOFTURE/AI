# @softure-ai/testing

Test tools shared by SOFTURE apps and modules. Today: a Vitest setup file that shifts the test clock
to `TEST_TODAY` while time keeps running, so date logic can be tested for a day that has not come yet.

## Installation

```bash
npm install --save-dev @softure-ai/testing
```

Not on npm yet: the package stays `"private": true`, so a release of "all" packages skips it, until its
first publish (roadmap deploy, DP-8) drops the flag. Inside this repository it is a workspace package.

## Clock shift

Date guards (a limit valid for one year, a price list that ends on a date) fail by design only on the
day their source stops being valid. Shifting the clock shows today what breaks then.

1. Add a one-line setup file to the app and list it in the Vitest config. Vitest reads `setupFiles` as
   paths, not package names, so the package is imported from a file of the app:

   ```ts
   // vitest.setup.ts
   import "@softure-ai/testing/vitest-setup";
   ```

   ```ts
   // vitest.config.mts
   export default defineConfig({ test: { setupFiles: ["./vitest.setup.ts"] } });
   ```

2. Run the tests on another day:

   ```bash
   TEST_TODAY=2027-01-02 npm test
   ```

   An optional script keeps the command short: `"test:at": "sh -c 'TEST_TODAY=$0 vitest run \"$@\"'"`, then
   `npm run test:at -- 2027-01-02`.

Without `TEST_TODAY` (or with it empty) the clock stays real and nothing is printed. With it, the setup
prints `[@softure-ai/testing] test clock shifted to <day> (TEST_TODAY)` on stderr, so a value left in the
shell or in a loaded `.env` cannot shift a normal run silently. A value that is not a real `YYYY-MM-DD`
date fails the run.

**A fixed default day.** An app that wants every run on a known day writes its own setup file with the
same functions:

```ts
// vitest.setup.ts
import { readTestToday, shiftClock } from "@softure-ai/testing";

shiftClock(readTestToday(process.env.TEST_TODAY) ?? "2027-01-02");
```

### How it behaves

- **A shift, not a freeze.** `Date` gets a fixed offset, so timeouts, durations and `setTimeout` work as
  usual. The day starts at noon local time, which keeps the same calendar day in every zone from UTC-11
  to UTC+11.
- **Only "now" moves.** `new Date()`, `Date.now()` and `Date()` are shifted; `new Date(value)`,
  `Date.UTC` and `Date.parse` are unchanged. `instanceof Date` still accepts dates made before the
  shift and by `structuredClone`.
- **With `vi.useFakeTimers()`.** Fake timers start from the shifted now; a test that sets its own time
  (`vi.useFakeTimers({ now })`, `vi.setSystemTime`) gets that time, and `vi.useRealTimers()` gives the
  shifted clock back.
- **Only the JavaScript clock moves.** Postgres (and PGlite) compute `now()` with the real date. A test
  that mixes both clocks, for example a token issued in SQL and checked in JavaScript, can fail under a
  large shift for reasons that say nothing about the date.
- **Module code takes the injected clock.** `@softure-ai/core`'s `Clock` (`systemClock`,
  `createTestClock`) stays the way modules read time ([core README](../core/README.md)); the shift also
  moves `systemClock`, because it reads the global `Date`.

## API

| Export | What it does |
| --- | --- |
| `@softure-ai/testing/vitest-setup` | Setup entry: shifts the clock when `TEST_TODAY` is set. |
| `readTestToday(value)` | Returns the day, or null for an unset or empty value; throws a `RangeError` for anything else that is not a real `YYYY-MM-DD` date. |
| `shiftClock(day)` | Moves the global `Date` to noon of `day` and lets it run; shifting again replaces the earlier shift. |
| `restoreClock()` | Puts the real `Date` back; does nothing when the clock is not shifted. |
| `isClockShifted()` | Whether the global `Date` is shifted. |

## Limitations

- Node only: the setup reads `process.env`.
- Code that captured `Date` before the setup ran (a module loaded earlier) keeps the real clock.
