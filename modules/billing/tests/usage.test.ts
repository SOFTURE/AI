// Usage limits, pure: the limits options, which meters the config declares, the limit per access
// state and plan, and the calendar month a consumption counts in.
import { billing, type BillingOptions, type BillingOptionsInput, getDeclaredMeters, getUsagePeriod, getUsageState, isDeclaredMeter, resolveLimit, resolveLimits } from "@softure-ai/billing";
import { describe, expect, it } from "vitest";

const TIMEZONE = "Europe/Warsaw";

/** The options as the module factory parsed them. */
function parseOptions(input: BillingOptionsInput): BillingOptions {
  return billing(input).options;
}

const OPTIONS = parseOptions({
  trial: { limits: { "ai-calls": 10 } },
  paid: { limits: { "ai-calls": 100, exports: 5 } },
  readOnly: { limits: { exports: 1 } },
  plans: [
    { id: "pro", name: { en: "Pro" }, price: { amount: 4900, currency: "PLN" }, period: "month", limits: { "ai-calls": 1000, exports: null } },
    { id: "basic", name: { en: "Basic" }, price: { amount: 1900, currency: "PLN" }, period: "month" },
  ],
});

describe("limits options", () => {
  it("default to no limits block anywhere", () => {
    const options = parseOptions({ plans: [{ id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" }] });
    expect([options.trial.limits, options.paid.limits, options.readOnly.limits, options.plans[0]?.limits]).toEqual([{}, {}, {}, {}]);
    expect(getDeclaredMeters(options)).toEqual([]);
  });

  it.each([
    ["a meter that is not kebab-case", { "AI calls": 1 }],
    ["a negative limit", { "ai-calls": -1 }],
    ["a fractional limit", { "ai-calls": 1.5 }],
    ["a limit above the maximum", { "ai-calls": 1_000_000_001 }],
    ["more than 20 meters", Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`meter-${String(index)}`, 1]))],
  ])("refuse %s", (_name, limits) => {
    expect(() => billing({ trial: { limits } })).toThrow("- options.trial.limits");
  });

  it("accept null as no limit", () => {
    expect(parseOptions({ paid: { limits: { "ai-calls": null } } }).paid.limits).toEqual({ "ai-calls": null });
  });
});

describe("getDeclaredMeters", () => {
  it("lists every meter some block names, once, sorted", () => {
    expect(getDeclaredMeters(OPTIONS)).toEqual(["ai-calls", "exports"]);
    expect(isDeclaredMeter(OPTIONS, "exports")).toBe(true);
    expect(isDeclaredMeter(OPTIONS, "uploads")).toBe(false);
  });
});

describe("resolveLimit", () => {
  it.each([
    ["the trial's limit", { status: "trial", planId: null }, "ai-calls", 10],
    ["0 for a meter the trial leaves out", { status: "trial", planId: null }, "exports", 0],
    ["the read-only limit", { status: "read_only", planId: null }, "exports", 1],
    ["0 for a meter read-only leaves out", { status: "read_only", planId: null }, "ai-calls", 0],
    ["the plan's limit", { status: "paid", planId: "pro" }, "ai-calls", 1000],
    ["the plan's null as no limit, over paid.limits", { status: "paid", planId: "pro" }, "exports", null],
    ["paid.limits for a plan without its own", { status: "paid", planId: "basic" }, "ai-calls", 100],
    ["paid.limits for paid access without a known plan", { status: "paid", planId: null }, "exports", 5],
    ["paid.limits for a plan the config no longer has", { status: "paid", planId: "retired" }, "ai-calls", 100],
  ] as const)("gives %s", (_name, subject, meter, limit) => {
    expect(resolveLimit(OPTIONS, subject, meter)).toBe(limit);
  });

  it("gives every declared meter at once", () => {
    expect(resolveLimits(OPTIONS, { status: "paid", planId: "pro" })).toEqual({ "ai-calls": 1000, exports: null });
    expect(resolveLimits(OPTIONS, { status: "trial", planId: null })).toEqual({ "ai-calls": 10, exports: 0 });
  });

  it("does not read a meter from the object's prototype", () => {
    expect(resolveLimit(OPTIONS, { status: "trial", planId: null }, "constructor")).toBe(0);
  });
});

describe("getUsagePeriod", () => {
  it.each([
    ["mid-month", "2026-10-03T08:00:00Z", "2026-09-30T22:00:00Z", "2026-10-31T23:00:00Z"],
    ["the first instant of a month in local time", "2026-09-30T22:00:00Z", "2026-09-30T22:00:00Z", "2026-10-31T23:00:00Z"],
    ["the last instant of a month in local time, a UTC day later", "2026-10-31T22:59:59.999Z", "2026-09-30T22:00:00Z", "2026-10-31T23:00:00Z"],
    ["across the year end", "2026-12-31T23:30:00Z", "2026-12-31T23:00:00Z", "2027-01-31T23:00:00Z"],
    ["across the change to summer time", "2027-03-15T12:00:00Z", "2027-02-28T23:00:00Z", "2027-03-31T22:00:00Z"],
  ])("is the local calendar month %s", (_name, now, start, end) => {
    expect(getUsagePeriod(new Date(now), TIMEZONE, "month")).toEqual({ start: new Date(start), end: new Date(end) });
  });

  it("follows the app's time zone", () => {
    expect(getUsagePeriod(new Date("2026-10-31T23:30:00Z"), "America/New_York", "month")).toEqual({
      start: new Date("2026-10-01T04:00:00Z"),
      end: new Date("2026-11-01T04:00:00Z"),
    });
  });
});

describe("getUsageState", () => {
  const bounds = { start: new Date("2026-09-30T22:00:00Z"), end: new Date("2026-10-31T23:00:00Z") };

  it("counts what is left, never below 0", () => {
    expect(getUsageState({ meter: "ai-calls", period: "month", used: 3, limit: 10, bounds })).toEqual({
      meter: "ai-calls",
      period: "month",
      used: 3,
      limit: 10,
      remaining: 7,
      periodStart: bounds.start,
      resetsAt: bounds.end,
    });
    expect(getUsageState({ meter: "ai-calls", period: "month", used: 12, limit: 10, bounds }).remaining).toBe(0);
    expect(getUsageState({ meter: "ai-calls", period: "month", used: 12, limit: null, bounds }).remaining).toBeNull();
  });
});
