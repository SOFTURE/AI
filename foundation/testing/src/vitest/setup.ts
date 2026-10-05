// Vitest setup file: `setupFiles: ["@softure-ai/testing/vitest-setup"]`. With `TEST_TODAY=YYYY-MM-DD`
// the test clock runs on that day; without it the clock stays real.
import { readTestToday, shiftClock } from "./shift-clock.js";

const today = readTestToday(process.env.TEST_TODAY);

if (today !== null) {
  shiftClock(today);
  // Loud on purpose: a value left in the shell or in a loaded `.env` would shift every run silently.
  console.warn(`[@softure-ai/testing] test clock shifted to ${today} (TEST_TODAY)`);
}
