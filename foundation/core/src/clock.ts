// Time is injected, never read from the global `Date` inside module logic, so tests control it
// (docs/02-module-standard.md §9, FIRE_TRACKER's `now` convention).

export interface Clock {
  /** The current instant. Every call returns a new `Date`, so callers may mutate it. */
  now(): Date;
}

/** A clock a test moves by hand. */
export interface TestClock extends Clock {
  /** Moves the clock forward (or back, with a negative value) by `milliseconds`. */
  advance(milliseconds: number): void;
  /** Moves the clock to `instant`. */
  set(instant: Date): void;
}

/** The real wall clock. */
export const systemClock: Clock = {
  now: () => new Date(),
};

export function createTestClock(start: Date): TestClock {
  let current = readTime(start);

  return {
    now: () => new Date(current),
    advance: (milliseconds) => {
      current += milliseconds;
    },
    set: (instant) => {
      current = readTime(instant);
    },
  };
}

function readTime(instant: Date): number {
  const time = instant.getTime();
  if (Number.isNaN(time)) {
    throw new RangeError("createTestClock: invalid start date");
  }
  return time;
}
