import { afterEach, describe, expect, it, vi } from "vitest";
import { isClockShifted, readTestToday, restoreClock, shiftClock } from "@softure-ai/testing";

const REAL_DATE = Date;

afterEach(() => {
  vi.useRealTimers();
  restoreClock();
});

function readLocalDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${String(date.getFullYear())}-${month}-${day}`;
}

describe("readTestToday", () => {
  it("returns null when TEST_TODAY is unset or empty, so the clock stays real", () => {
    expect(readTestToday(undefined)).toBeNull();
    expect(readTestToday("")).toBeNull();
  });

  it("returns a valid YYYY-MM-DD day unchanged", () => {
    expect(readTestToday("2027-01-02")).toBe("2027-01-02");
    expect(readTestToday("2028-02-29")).toBe("2028-02-29");
  });

  it.each(["sh", "2027-1-2", "2027-01-02T00:00", " 2027-01-02", "2027-02-30", "2027-13-01", "2027-00-10", "2027-02-29"])(
    "refuses %j with a message that names the value and the form",
    (value) => {
      expect(() => readTestToday(value)).toThrow(
        new RangeError(`TEST_TODAY must be a real date in the form YYYY-MM-DD, got "${value}". Example: 2027-01-02`),
      );
    },
  );
});

describe("shiftClock", () => {
  it("moves new Date(), Date.now() and Date() to noon of the given local day", () => {
    shiftClock("2027-01-02");

    const shifted = new Date();
    expect(readLocalDay(shifted)).toBe("2027-01-02");
    expect(shifted.getHours()).toBe(12);
    expect(shifted.getMinutes()).toBe(0);
    expect(Math.abs(Date.now() - new REAL_DATE(2027, 0, 2, 12).getTime())).toBeLessThan(1_000);
    expect(Date()).toBe(new Date().toString());
    expect(Date()).toContain("Jan 02 2027");
  });

  it("keeps time running instead of freezing it", async () => {
    shiftClock("2027-01-02");
    const before = Date.now();

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(Date.now() - before).toBeGreaterThanOrEqual(15);
  });

  it("leaves dates built from explicit values and the static helpers unchanged", () => {
    shiftClock("2027-01-02");

    expect(new Date(0).toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(new Date("2026-10-05T10:00:00Z").getTime()).toBe(REAL_DATE.UTC(2026, 9, 5, 10));
    expect(new Date(2026, 9, 5).getDate()).toBe(5);
    expect(Date.UTC(2026, 9, 5)).toBe(REAL_DATE.UTC(2026, 9, 5));
    expect(Date.parse("2026-10-05T00:00:00Z")).toBe(REAL_DATE.parse("2026-10-05T00:00:00Z"));
    expect(Date.name).toBe("Date");
  });

  it("still recognises real Date instances made before the shift or by structuredClone", () => {
    const madeBefore = new REAL_DATE(0);
    shiftClock("2027-01-02");

    expect(madeBefore instanceof Date).toBe(true);
    expect(structuredClone(new Date()) instanceof Date).toBe(true);
    expect(new Date() instanceof REAL_DATE).toBe(true);
    expect({} instanceof Date).toBe(false);
  });

  it("replaces an earlier shift, and one restore brings the real Date back", () => {
    shiftClock("2027-01-02");
    shiftClock("2030-06-15");

    expect(readLocalDay(new Date())).toBe("2030-06-15");

    restoreClock();
    expect(Date).toBe(REAL_DATE);
    expect(isClockShifted()).toBe(false);
  });

  it("refuses an invalid day and leaves the clock real", () => {
    expect(() => shiftClock("2027-02-30")).toThrow(RangeError);
    expect(Date).toBe(REAL_DATE);
    expect(isClockShifted()).toBe(false);
  });
});

describe("restoreClock", () => {
  it("does nothing when the clock is not shifted", () => {
    restoreClock();

    expect(Date).toBe(REAL_DATE);
    expect(isClockShifted()).toBe(false);
  });

  it("reports the shift until it is restored", () => {
    shiftClock("2027-01-02");
    expect(isClockShifted()).toBe(true);

    restoreClock();
    expect(isClockShifted()).toBe(false);
  });
});

describe("with vi.useFakeTimers in the same file", () => {
  it("starts fake timers from the shifted now", () => {
    shiftClock("2027-01-02");

    vi.useFakeTimers();

    expect(readLocalDay(new Date())).toBe("2027-01-02");
    expect(new Date().getHours()).toBe(12);
  });

  it("lets a test set its own fake time and gives the shifted clock back afterwards", () => {
    shiftClock("2027-01-02");

    vi.useFakeTimers({ now: new Date("2030-05-05T15:00:00Z") });
    expect(new Date().toISOString()).toBe("2030-05-05T15:00:00.000Z");
    expect(Date.now()).toBe(REAL_DATE.UTC(2030, 4, 5, 15));

    vi.useRealTimers();
    expect(readLocalDay(new Date())).toBe("2027-01-02");
    expect(isClockShifted()).toBe(true);
  });
});
