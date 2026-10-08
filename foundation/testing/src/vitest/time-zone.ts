// Pins the test process to one time zone. Code that converts explicitly to UTC or to the app's zone
// gives the same result as code that forgets the zone when tests run in UTC or in the machine's zone,
// so date tests can pass by construction. A zone with a negative offset tells the two apart: late in
// the evening there, the calendar day already differs from UTC and from European zones.
//
// Node applies `TZ` per process: an assignment switches the zone at once in the main thread, and does
// nothing inside a worker thread. Vitest's `forks` pool runs setup files in a child process, where the
// assignment works; `threads` and `vmThreads` run them in a worker thread, where only a zone pinned in
// the main process (the Vitest config, before workers start) holds.
//
// No imports and only erasable TypeScript: a test loads this file in a real worker thread straight
// from source, through Node's type stripping.

/** The zone tests run in unless `TEST_TZ` names another: its offset is negative all year. */
export const DEFAULT_TEST_TIME_ZONE = "America/New_York";

/**
 * Reads a `TEST_TZ` value. Returns `DEFAULT_TEST_TIME_ZONE` when it is unset or empty. Throws a
 * `RangeError` for a name that is not a time zone: as `TZ`, it would turn into UTC silently.
 */
export function readTestTimeZone(value: string | undefined): string {
  if (value === undefined || value === "") return DEFAULT_TEST_TIME_ZONE;
  if (!isTimeZone(value)) {
    throw new RangeError(`TEST_TZ must be an IANA time zone such as ${DEFAULT_TEST_TIME_ZONE}, got "${value}"`);
  }
  return value;
}

/**
 * Switches the process to `timeZone` through `TZ`. Does nothing when the process already runs in it.
 * Throws when the zone is unknown, or when the switch did not take effect (inside a worker thread).
 */
export function pinTimeZone(timeZone: string): void {
  if (!isTimeZone(timeZone)) {
    throw new RangeError(`pinTimeZone: "${timeZone}" is not an IANA time zone`);
  }
  const wanted = toCanonicalTimeZone(timeZone);
  if (readProcessTimeZone() === wanted) return;

  process.env.TZ = timeZone;
  const actual = readProcessTimeZone();
  if (actual !== wanted) {
    throw new Error(
      `pinTimeZone: the process still runs in "${actual}" after TZ was set to "${timeZone}". ` +
        "Node applies TZ per process, so it cannot change inside a worker thread (Vitest pools threads and vmThreads). " +
        'Call pinTestTimeZone() at the top of vitest.config.* (it runs before the workers start), or use pool: "forks".',
    );
  }
}

/**
 * Pins the test zone for a whole Vitest run; call it at the top of `vitest.config.*`. `TEST_TZ` from
 * the shell wins over `timeZone`, so a one-off run in another zone needs no edit. The choice is stored
 * in `TEST_TZ`, where the setup file in every worker finds it. Returns the pinned zone.
 */
export function pinTestTimeZone(timeZone: string = DEFAULT_TEST_TIME_ZONE): string {
  const fromShell = process.env.TEST_TZ;
  const pinned = fromShell === undefined || fromShell === "" ? readTestTimeZone(timeZone) : readTestTimeZone(fromShell);
  process.env.TEST_TZ = pinned;
  pinTimeZone(pinned);
  return pinned;
}

function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/** The name `Intl` reports for a zone, so an alias (`US/Eastern`) compares equal to its zone. */
function toCanonicalTimeZone(name: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: name }).resolvedOptions().timeZone;
}

function readProcessTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}
