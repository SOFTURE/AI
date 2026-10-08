// Vitest setup file: `setupFiles: ["@softure-ai/testing/vitest-setup"]`. Pins the process to
// `TEST_TZ` (default `America/New_York`, a negative offset), then, with `TEST_TODAY=YYYY-MM-DD`, runs
// the test clock on that day; without it the clock stays real.
import { readTestToday, shiftClock } from "./shift-clock.js";
import { pinTestTimeZone } from "./time-zone.js";

// First: the clock shift computes noon of `TEST_TODAY` in the local zone.
pinTestTimeZone();

const today = readTestToday(process.env.TEST_TODAY);

if (today !== null) {
  shiftClock(today);
  // Loud on purpose: a value left in the shell or in a loaded `.env` would shift every run silently.
  console.warn(`[@softure-ai/testing] test clock shifted to ${today} (TEST_TODAY)`);
}
