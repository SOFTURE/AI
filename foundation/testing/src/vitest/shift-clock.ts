// Shifts the global `Date` to another calendar day while time keeps running (FIRE_TRACKER's
// `vitest.shift-clock.ts`). Date guards fail by design only on the day their source stops being valid;
// shifting the clock shows today what breaks then, without waiting for that day.
//
// A shift, not a freeze: `Date` gets a fixed offset, so timeouts, durations and `setTimeout` behave as
// usual. `vi.useFakeTimers()` freezes time instead; a test that turns fake timers on starts them from the
// shifted now and gets the shifted `Date` back after `vi.useRealTimers()`.
//
// Only the JavaScript clock moves. A database computes `now()` with the real date, so a test that mixes
// both clocks can fail under a large shift for reasons that say nothing about the date.

const TEST_TODAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Kept on `globalThis`, not in this module: a test runner may load this module once per test file
// in the same process, and every copy has to find the real `Date` the first one replaced.
const REAL_DATE_KEY = Symbol.for("@softure-ai/testing.realDate");

type ShiftableGlobal = typeof globalThis & { [REAL_DATE_KEY]?: DateConstructor };

/**
 * Reads a `TEST_TODAY` value. Returns null when it is unset or empty, so the clock stays real.
 * Throws a `RangeError` for anything that is not a real `YYYY-MM-DD` date.
 */
export function readTestToday(value: string | undefined): string | null {
  if (value === undefined || value === "") return null;
  parseCalendarDay(value);
  return value;
}

/**
 * Moves the global clock to noon (local time) of `today` (`YYYY-MM-DD`) and lets it keep running.
 * Noon keeps the same calendar day in every zone from UTC-11 to UTC+11, so code that reads the date
 * with local getters sees `today`. Shifting again replaces the previous shift.
 */
export function shiftClock(today: string): void {
  const { year, monthIndex, day } = parseCalendarDay(today);
  const RealDate = getRealDate();
  const offsetMs = new RealDate(year, monthIndex, day, 12).getTime() - RealDate.now();

  class ShiftedDate extends RealDate {
    constructor(...args: [] | ConstructorParameters<DateConstructor>) {
      if (args.length === 0) {
        super(RealDate.now() + offsetMs);
      } else {
        super(...args);
      }
    }

    static override now(): number {
      return RealDate.now() + offsetMs;
    }
  }

  // `Date()` without `new` returns the current instant as a string; a class would throw
  // "Class constructor cannot be invoked without 'new'" instead.
  const ShiftedDateConstructor = new Proxy(ShiftedDate, {
    apply: () => new ShiftedDate().toString(),
  });
  // Dates made before the shift, by `fs.Stats` or by `structuredClone` are real `Date` instances, not
  // instances of the subclass; `instanceof Date` must keep accepting them.
  Object.defineProperty(ShiftedDateConstructor, Symbol.hasInstance, {
    value: (candidate: unknown) => candidate instanceof RealDate,
  });
  // Code that prints or compares `Date.name` keeps seeing the built-in name.
  Object.defineProperty(ShiftedDate, "name", { value: "Date" });
  globalThis.Date = ShiftedDateConstructor as DateConstructor;
}

/** Puts the real `Date` back. Does nothing when the clock is not shifted. */
export function restoreClock(): void {
  const shiftable = globalThis as ShiftableGlobal;
  const RealDate = shiftable[REAL_DATE_KEY];
  if (RealDate === undefined) return;
  globalThis.Date = RealDate;
  delete shiftable[REAL_DATE_KEY];
}

/** Whether `shiftClock` replaced the global `Date` and `restoreClock` has not put it back. */
export function isClockShifted(): boolean {
  return (globalThis as ShiftableGlobal)[REAL_DATE_KEY] !== undefined;
}

function getRealDate(): DateConstructor {
  const shiftable = globalThis as ShiftableGlobal;
  shiftable[REAL_DATE_KEY] ??= globalThis.Date;
  return shiftable[REAL_DATE_KEY];
}

function parseCalendarDay(value: string): { year: number; monthIndex: number; day: number } {
  const match = TEST_TODAY_PATTERN.exec(value);
  const year = Number(match?.[1]);
  const monthIndex = Number(match?.[2]) - 1;
  const day = Number(match?.[3]);
  // A UTC date rolls an impossible day over (2027-02-30 becomes March 2), so a mismatch means
  // the day does not exist.
  const probe = new Date(Date.UTC(year, monthIndex, day));
  const isRealDay =
    match !== null && probe.getUTCFullYear() === year && probe.getUTCMonth() === monthIndex && probe.getUTCDate() === day;
  if (!isRealDay) {
    throw new RangeError(`TEST_TODAY must be a real date in the form YYYY-MM-DD, got "${value}". Example: 2027-01-02`);
  }
  return { year, monthIndex, day };
}
