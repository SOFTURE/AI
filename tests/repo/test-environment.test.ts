import { describe, expect, it } from "vitest";

// `TEST_TZ=<zone> npm test` runs the suite in another zone on purpose; the date check below only
// holds in the default zone.
const PROBE_ZONE = process.env.TEST_TZ;

// The owner's shell exports NODE_ENV=production, and Vitest keeps whatever the shell says.
// React and other libraries switch behaviour on NODE_ENV, so the suite pins it (vitest.config.mts).
// The time zone is pinned to a negative offset so a missing explicit zone in code changes the date
// (docs/02-module-standard.md §10: the test zone must differ from UTC).
describe("test environment", () => {
  it("runs with NODE_ENV=test whatever the shell exports", () => {
    expect(process.env.NODE_ENV).toBe("test");
  });

  it("runs in America/New_York unless TEST_TZ names another zone", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(PROBE_ZONE || "America/New_York");
  });

  it.skipIf(PROBE_ZONE)("puts 03:00 UTC on 1 January on 31 December (a negative offset)", () => {
    expect(new Date("2026-01-01T03:00:00Z").getDate()).toBe(31);
  });
});
