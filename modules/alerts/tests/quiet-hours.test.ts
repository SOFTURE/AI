// Quiet hours: when a message may go out, across midnight, inside one day, for exempt severities and across DST.
import { getQuietHoursRelease, quietHoursSchema } from "@softure-ai/alerts";
import { describe, expect, it } from "vitest";

const NIGHT = quietHoursSchema.parse({ from: "22:00", to: "07:00", timeZone: "Europe/Warsaw" });
const LUNCH = quietHoursSchema.parse({ from: "12:00", to: "13:00", timeZone: "UTC", exceptSeverities: [] });

describe("getQuietHoursRelease", () => {
  it("sends at once outside the window", () => {
    const now = new Date("2026-11-02T20:59:00Z"); // 21:59 in Warsaw
    expect(getQuietHoursRelease(now, NIGHT, "warning")).toEqual(now);
  });

  it("waits until the morning before midnight and after it", () => {
    expect(getQuietHoursRelease(new Date("2026-11-02T21:00:00Z"), NIGHT, "warning")).toEqual(new Date("2026-11-03T06:00:00Z"));
    expect(getQuietHoursRelease(new Date("2026-11-03T03:00:00Z"), NIGHT, "info")).toEqual(new Date("2026-11-03T06:00:00Z"));
  });

  it("ends exactly at the end time", () => {
    const now = new Date("2026-11-03T06:00:00Z"); // 07:00 in Warsaw
    expect(getQuietHoursRelease(now, NIGHT, "warning")).toEqual(now);
  });

  it("sends exempt severities at once (critical by default)", () => {
    const now = new Date("2026-11-02T23:00:00Z");
    expect(getQuietHoursRelease(now, NIGHT, "critical")).toEqual(now);
    expect(getQuietHoursRelease(new Date("2026-11-02T12:30:00Z"), LUNCH, "critical")).toEqual(new Date("2026-11-02T13:00:00Z"));
  });

  it("handles a window inside one day", () => {
    expect(getQuietHoursRelease(new Date("2026-11-02T11:59:00Z"), LUNCH, "info")).toEqual(new Date("2026-11-02T11:59:00Z"));
    expect(getQuietHoursRelease(new Date("2026-11-02T12:00:00Z"), LUNCH, "info")).toEqual(new Date("2026-11-02T13:00:00Z"));
  });

  it("ends at the local time on the night the clocks change", () => {
    // 2027-03-28: Warsaw moves from UTC+1 to UTC+2 at 02:00, so 07:00 local is 05:00 UTC.
    expect(getQuietHoursRelease(new Date("2027-03-27T22:00:00Z"), NIGHT, "info")).toEqual(new Date("2027-03-28T05:00:00Z"));
  });

  it("does nothing without quiet hours", () => {
    const now = new Date("2026-11-02T23:00:00Z");
    expect(getQuietHoursRelease(now, undefined, "info")).toEqual(now);
  });
});

describe("quietHoursSchema", () => {
  it("refuses malformed times, an unknown zone and an empty window", () => {
    expect(quietHoursSchema.safeParse({ from: "24:00", to: "07:00", timeZone: "UTC" }).success).toBe(false);
    expect(quietHoursSchema.safeParse({ from: "22:00", to: "7:00", timeZone: "UTC" }).success).toBe(false);
    expect(quietHoursSchema.safeParse({ from: "22:00", to: "07:00", timeZone: "Mars/Olympus" }).success).toBe(false);
    expect(quietHoursSchema.safeParse({ from: "22:00", to: "22:00", timeZone: "UTC" }).success).toBe(false);
  });
});
