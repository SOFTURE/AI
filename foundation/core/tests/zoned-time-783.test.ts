import { describe, expect, it } from "vitest";
import {
  getDayStartInstant,
  getLocalDateTimeInstant,
  getWallClock,
  getZonedInstant,
  isTimeZone,
  localDateTimeSchema,
  toCalendarDay,
  type LocalDateTime,
} from "@softure-ai/core";

const local = (value: string): LocalDateTime => localDateTimeSchema.parse(value);

describe("getDayStartInstant", () => {
  it("returns local midnight of the day in the given zone, not in the process zone", () => {
    expect(getDayStartInstant("2026-10-04", "Europe/Warsaw").toISOString()).toBe("2026-10-03T22:00:00.000Z");
    expect(getDayStartInstant("2026-10-04", "UTC").toISOString()).toBe("2026-10-04T00:00:00.000Z");
  });

  it("returns midnight behind UTC in a negative-offset zone", () => {
    expect(getDayStartInstant("2026-01-15", "America/New_York").toISOString()).toBe("2026-01-15T05:00:00.000Z");
    expect(getDayStartInstant("2026-07-15", "America/New_York").toISOString()).toBe("2026-07-15T04:00:00.000Z");
  });

  it("starts the Warsaw spring-forward and fall-back days at local midnight, so the days are 23 and 25 hours long", () => {
    const spring = getDayStartInstant("2026-03-29", "Europe/Warsaw");
    const autumn = getDayStartInstant("2026-10-25", "Europe/Warsaw");
    expect(spring.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(getDayStartInstant("2026-03-30", "Europe/Warsaw").getTime() - spring.getTime()).toBe(23 * 3_600_000);
    expect(autumn.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(getDayStartInstant("2026-10-26", "Europe/Warsaw").getTime() - autumn.getTime()).toBe(25 * 3_600_000);
  });

  it("gives the instant after the change on a day whose midnight is skipped", () => {
    // Chile moves to summer time on 6 September 2026 at 00:00, straight to 01:00.
    const start = getDayStartInstant("2026-09-06", "America/Santiago");
    expect(start.toISOString()).toBe("2026-09-06T04:00:00.000Z");
    expect(toCalendarDay(start, "America/Santiago")).toBe("2026-09-06");
  });

  it("is the inverse of toCalendarDay at the day's first instant", () => {
    const start = getDayStartInstant("2026-12-31", "Asia/Tokyo");
    expect(toCalendarDay(start, "Asia/Tokyo")).toBe("2026-12-31");
    expect(toCalendarDay(new Date(start.getTime() - 1), "Asia/Tokyo")).toBe("2026-12-30");
  });

  it("rejects a malformed day and an invalid zone, naming the function", () => {
    expect(() => getDayStartInstant("2026-02-30", "UTC")).toThrow(
      new RangeError('getDayStartInstant: "2026-02-30" is not a YYYY-MM-DD calendar day'),
    );
    expect(() => getDayStartInstant("2026-10-04", "Mars/Olympus")).toThrow(
      new RangeError('getDayStartInstant: "Mars/Olympus" is not an IANA time zone'),
    );
  });
});

describe("getLocalDateTimeInstant", () => {
  it("returns the instant a clock in the zone shows the local date-time", () => {
    expect(getLocalDateTimeInstant(local("2026-10-04T09:30"), "Europe/Warsaw").toISOString()).toBe("2026-10-04T07:30:00.000Z");
    expect(getLocalDateTimeInstant(local("2026-10-04T09:30"), "America/New_York").toISOString()).toBe("2026-10-04T13:30:00.000Z");
  });

  it("gives the first occurrence of an hour the fall-back change repeats", () => {
    expect(getLocalDateTimeInstant(local("2026-10-25T02:30"), "Europe/Warsaw").toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });

  it("moves a time the spring-forward change skips forward by the same distance", () => {
    // 02:30 does not occur on 29 March 2026 in Warsaw; 03:30 summer time does.
    expect(getLocalDateTimeInstant(local("2026-03-29T02:30"), "Europe/Warsaw").toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("rejects a malformed value and an invalid zone, naming the function", () => {
    expect(() => getLocalDateTimeInstant("2026-10-04 09:30" as LocalDateTime, "UTC")).toThrow(
      new RangeError('getLocalDateTimeInstant: "2026-10-04 09:30" is not a YYYY-MM-DDTHH:mm local date-time'),
    );
    expect(() => getLocalDateTimeInstant(local("2026-10-04T09:30"), "Nowhere/City")).toThrow(
      new RangeError('getLocalDateTimeInstant: "Nowhere/City" is not an IANA time zone'),
    );
  });
});

describe("getWallClock and getZonedInstant", () => {
  it("read the wall clock of an instant and turn it back into the same instant", () => {
    const instant = new Date("2026-03-29T01:15:00.000Z");
    const wallClock = getWallClock(instant, "Europe/Warsaw");
    expect(wallClock).toEqual({ year: 2026, month: 3, day: 29, hour: 3, minute: 15 });
    expect(getZonedInstant(wallClock, "Europe/Warsaw")).toEqual(instant);
  });

  it("show midnight as hour 0, not 24", () => {
    expect(getWallClock(new Date("2026-10-03T22:00:00.000Z"), "Europe/Warsaw")).toEqual({ year: 2026, month: 10, day: 4, hour: 0, minute: 0 });
  });

  it("reject an invalid date or zone, naming the function", () => {
    expect(() => getWallClock(new Date("not a date"), "UTC")).toThrow(new RangeError("getWallClock: invalid date"));
    expect(() => getZonedInstant({ year: 2026, month: 1, day: 1, hour: 0, minute: 0 }, "Bad/Zone")).toThrow(
      new RangeError('getZonedInstant: "Bad/Zone" is not an IANA time zone'),
    );
  });
});

describe("isTimeZone", () => {
  it("accepts IANA zones the runtime knows", () => {
    expect(isTimeZone("Europe/Warsaw")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("America/New_York")).toBe(true);
  });

  it("rejects an unknown name and the empty string", () => {
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone("")).toBe(false);
  });
});
