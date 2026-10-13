import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calendarDaySchema,
  defineSoftureConfig,
  formatCalendarMonth,
  formatDuration,
  formatPercent,
  isCalendarMonth,
  memoizeByContent,
} from "@softure-ai/core";

/** `Intl` puts no-break and narrow no-break spaces between the parts; the tests compare plain spaces. */
function plain(text: string): string {
  return text.replace(/[\u00a0\u202f]/g, " ");
}

describe("formatCalendarMonth", () => {
  it("writes month and year, the Polish month in the nominative by default and in the genitive on request", () => {
    expect(formatCalendarMonth("2026-10", "pl")).toBe("pa\u017adziernik 2026");
    expect(formatCalendarMonth("2026-10", "pl", "genitive")).toBe("pa\u017adziernika 2026");
    expect(formatCalendarMonth("2026-10", "en")).toBe("October 2026");
    expect(formatCalendarMonth("2026-10", "en", "genitive")).toBe("October 2026");
  });

  it("writes the month in Roman numerals for compact tables", () => {
    expect(formatCalendarMonth("2026-10", "pl", "roman")).toBe("X 2026");
    expect(formatCalendarMonth("2026-04", "en", "roman")).toBe("IV 2026");
    expect(formatCalendarMonth("2026-09", "en", "roman")).toBe("IX 2026");
    expect(formatCalendarMonth("2026-12", "en", "roman")).toBe("XII 2026");
  });

  it("takes a calendar day and keeps its month whatever the process zone", () => {
    expect(formatCalendarMonth("2026-01-01", "en")).toBe("January 2026");
    expect(formatCalendarMonth("2026-03-31", "pl", "roman")).toBe("III 2026");
  });

  it("rejects a malformed month", () => {
    expect(() => formatCalendarMonth("2026-13", "en")).toThrow(new RangeError('formatCalendarMonth: "2026-13" is not a YYYY-MM month or a YYYY-MM-DD day'));
    expect(() => formatCalendarMonth("2026-2", "en")).toThrow(RangeError);
    expect(() => formatCalendarMonth("2026-02-30", "en")).toThrow(RangeError);
  });

  it("tells a YYYY-MM month apart", () => {
    expect(isCalendarMonth("2026-10")).toBe(true);
    expect(isCalendarMonth("2026-00")).toBe(false);
    expect(isCalendarMonth("2026-10-01")).toBe(false);
    expect(isCalendarMonth(202610)).toBe(false);
  });
});

describe("formatDuration", () => {
  it("writes years and months in English", () => {
    expect(formatDuration(13, "en")).toBe("1 year and 1 month");
    expect(formatDuration(24, "en")).toBe("2 years");
    expect(formatDuration(2, "en")).toBe("2 months");
    expect(formatDuration(0, "en")).toBe("0 months");
  });

  it("rejects a negative or fractional count", () => {
    expect(() => formatDuration(-1, "en")).toThrow(new RangeError("formatDuration: -1 is not a whole, non-negative number of months"));
    expect(() => formatDuration(1.5, "en")).toThrow(RangeError);
  });
});

describe("formatPercent options", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("signs a value with signed, never zero", () => {
    expect(formatPercent(-50, "pl", { signed: true })).toBe("-0,5%");
    expect(formatPercent(1250, "pl", { signed: true })).toBe("+12,5%");
    expect(formatPercent(1250, "en", { signed: true })).toBe("+12.5%");
    expect(formatPercent(0, "en", { signed: true })).toBe("0%");
    expect(formatPercent(-0.4, "en", { signed: true })).toBe("0%");
  });

  it("never puts a minus on a value that rounds to zero", () => {
    expect(formatPercent(-0.4, "en")).toBe("0%");
    expect(formatPercent(-0, "pl")).toBe("0%");
    expect(formatPercent(-50, "en")).toBe("-0.5%");
  });

  it("drops the space before the percent sign with tight", () => {
    // Bound per call below, so the unbound method is never called without its formatter.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = Intl.NumberFormat.prototype.formatToParts;
    vi.spyOn(Intl.NumberFormat.prototype, "formatToParts").mockImplementation(function (this: Intl.NumberFormat, value) {
      return original.call(this, value).flatMap((part) => (part.type === "percentSign" ? [{ type: "literal", value: "\u00a0" }, part] : [part]));
    });
    expect(formatPercent(1250, "pl", { tight: true, signed: true })).toBe("+12,5%");
    expect(plain(formatPercent(1250, "pl"))).toBe("12,5%");
  });
});

describe("memoizeByContent", () => {
  it("calls the function once per argument content, whatever the key order", () => {
    const fn = vi.fn((input: { a: number; b: readonly number[] }, day: Date) => input.a + input.b.length + day.getTime());
    const memoized = memoizeByContent(fn, { max: 10 });
    expect(memoized({ a: 1, b: [1, 2] }, new Date(0))).toBe(3);
    expect(memoized({ b: [1, 2], a: 1 }, new Date(0))).toBe(3);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(memoized({ a: 1, b: [2, 1] }, new Date(0))).toBe(3);
    expect(memoized({ a: 1, b: [1, 2] }, new Date(1))).toBe(4);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("tells apart values JSON would merge", () => {
    const fn = vi.fn((value: unknown) => typeof value);
    const memoized = memoizeByContent(fn, { max: 10 });
    memoized(1);
    memoized("1");
    memoized(null);
    memoized(undefined);
    memoized([undefined]);
    memoized([null]);
    memoized(-0);
    memoized(0);
    expect(fn).toHaveBeenCalledTimes(8);
  });

  it("evicts the least recently used entry beyond max", () => {
    const fn = vi.fn((value: number) => value * 2);
    const memoized = memoizeByContent(fn, { max: 2 });
    memoized(1);
    memoized(2);
    memoized(1);
    memoized(3);
    expect(fn).toHaveBeenCalledTimes(3);
    memoized(1);
    expect(fn).toHaveBeenCalledTimes(3);
    memoized(2);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("clears the cache on demand", () => {
    const fn = vi.fn((value: number) => value);
    const memoized = memoizeByContent(fn, { max: 2 });
    memoized(1);
    memoized.clear();
    memoized(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not keep a rejected promise", async () => {
    let calls = 0;
    const memoized = memoizeByContent((value: number) => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error("first call fails")) : Promise.resolve(value);
    }, { max: 2 });
    await expect(memoized(1)).rejects.toThrow("first call fails");
    await expect(memoized(1)).resolves.toBe(1);
    await expect(memoized(1)).resolves.toBe(1);
    expect(calls).toBe(2);
  });

  it("refuses arguments it cannot key by content", () => {
    const memoized = memoizeByContent((value: unknown) => value, { max: 2 });
    expect(() => memoized(() => 1)).toThrow(new TypeError("memoizeByContent: an argument holds a function, which has no content key"));
    expect(() => memoized(new Map())).toThrow(TypeError);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => memoized(cyclic)).toThrow(new TypeError("memoizeByContent: an argument holds a cycle"));
  });

  it("refuses a max that is not a positive whole number", () => {
    expect(() => memoizeByContent((value: number) => value, { max: 0 })).toThrow(new RangeError("memoizeByContent: max must be a positive whole number, got 0"));
    expect(() => memoizeByContent((value: number) => value, { max: 1.5 })).toThrow(RangeError);
  });
});

describe("landingOrigin", () => {
  const base = { locale: "en", timezone: "Europe/Warsaw", appOrigin: "https://app.example.com", modules: [] } as const;

  it("defaults to appOrigin", () => {
    expect(defineSoftureConfig(base).landingOrigin).toBe("https://app.example.com");
  });

  it("keeps the landing site the app names", () => {
    expect(defineSoftureConfig({ ...base, landingOrigin: "https://example.com" }).landingOrigin).toBe("https://example.com");
  });

  it("refuses a landing origin with a path", () => {
    expect(() => defineSoftureConfig({ ...base, landingOrigin: "https://example.com/home" })).toThrow(/landingOrigin/);
  });
});

describe("calendarDaySchema", () => {
  it("accepts a real YYYY-MM-DD day and refuses anything else", () => {
    expect(calendarDaySchema.parse("2026-02-28")).toBe("2026-02-28");
    expect(calendarDaySchema.safeParse("2026-02-29").success).toBe(false);
    expect(calendarDaySchema.safeParse("2026-2-1").success).toBe(false);
    expect(calendarDaySchema.safeParse(20260228).success).toBe(false);
  });
});
