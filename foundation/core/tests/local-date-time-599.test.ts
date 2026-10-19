import { describe, expect, expectTypeOf, it } from "vitest";
import { getLocalDay, isLocalDateTime, localDateTimeSchema, type LocalDateTime } from "@softure-ai/core";

describe("isLocalDateTime", () => {
  it("accepts a wall-clock time on a real day", () => {
    expect(isLocalDateTime("2026-12-01T00:00")).toBe(true);
    expect(isLocalDateTime("2028-02-29T23:59")).toBe(true);
  });

  it.each([
    ["a day the month lacks", "2026-02-30T10:00"],
    ["hour 24", "2026-12-01T24:00"],
    ["minute 60", "2026-12-01T10:60"],
    ["seconds", "2026-12-01T10:00:00"],
    ["an offset", "2026-12-01T10:00Z"],
    ["a space instead of T", "2026-12-01 10:00"],
    ["a lower-case t", "2026-12-01t10:00"],
    ["a one-digit hour", "2026-12-01T9:00"],
    ["a day alone", "2026-12-01"],
    ["an empty string", ""],
  ])("refuses %s", (_case, value) => {
    expect(isLocalDateTime(value)).toBe(false);
  });

  it("refuses a non-string", () => {
    expect(isLocalDateTime(new Date())).toBe(false);
    expect(isLocalDateTime(null)).toBe(false);
  });
});

describe("localDateTimeSchema", () => {
  it("parses a local date-time into the branded type", () => {
    const value = localDateTimeSchema.parse("2026-12-01T10:30");
    expect(value).toBe("2026-12-01T10:30");
    expectTypeOf(value).toEqualTypeOf<LocalDateTime>();
  });

  it("refuses an impossible day with an English message", () => {
    const result = localDateTimeSchema.safeParse("2026-02-30T10:00");
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "must be a YYYY-MM-DDTHH:mm local date-time on a real day, e.g. 2026-10-04T09:30",
    ]);
  });

  it("does not let a plain string pass as a LocalDateTime", () => {
    expectTypeOf<string>().not.toExtend<LocalDateTime>();
  });
});

describe("getLocalDay", () => {
  it("returns the calendar day of a local date-time", () => {
    expect(getLocalDay(localDateTimeSchema.parse("2026-12-31T23:59"))).toBe("2026-12-31");
  });

  it("throws a RangeError for a value that was cast, not parsed", () => {
    expect(() => getLocalDay("2026-02-30T10:00" as LocalDateTime)).toThrow(
      new RangeError('getLocalDay: "2026-02-30T10:00" is not a YYYY-MM-DDTHH:mm local date-time'),
    );
  });
});
