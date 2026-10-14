// Usage limits, pure: which meters the config declares, the limit of one meter for an account in a
// given state and plan, and the calendar month a consumption counts in.
import { addCalendarMonths, toCalendarDay } from "@softure-ai/core";
import { getStartOfDay, parseDay } from "./calendar.js";
import type { EntitlementStatus, UsageLimits, UsagePeriod, UsageState } from "./contract.js";
import type { BillingOptions } from "./options.js";

/** Every meter some limits block of the config names, sorted. */
export function getDeclaredMeters(options: BillingOptions): readonly string[] {
  const blocks = [options.trial.limits, options.paid.limits, options.readOnly.limits, ...options.plans.map((plan) => plan.limits)];
  return [...new Set(blocks.flatMap((limits) => Object.keys(limits)))].sort();
}

/** Whether some limits block of the config names `meter`. */
export function isDeclaredMeter(options: BillingOptions, meter: string): boolean {
  return getDeclaredMeters(options).includes(meter);
}

export interface LimitSubject {
  readonly status: EntitlementStatus;
  /** The plan paying for today, or null. */
  readonly planId: string | null;
}

function readLimit(limits: UsageLimits, meter: string): number | null | undefined {
  return Object.hasOwn(limits, meter) ? limits[meter] : undefined;
}

/**
 * The limit of `meter` for an account in `subject`'s state: the trial's or the read-only block's,
 * and for paid access the plan's, else `paid.limits`. A meter the block leaves out has limit 0.
 */
export function resolveLimit(options: BillingOptions, subject: LimitSubject, meter: string): number | null {
  switch (subject.status) {
    case "trial":
      return readLimit(options.trial.limits, meter) ?? 0;
    case "read_only":
      return readLimit(options.readOnly.limits, meter) ?? 0;
    case "paid": {
      const plan = subject.planId === null ? undefined : options.plans.find((candidate) => candidate.id === subject.planId);
      const planLimit = plan === undefined ? undefined : readLimit(plan.limits, meter);
      return planLimit !== undefined ? planLimit : (readLimit(options.paid.limits, meter) ?? 0);
    }
  }
}

/** Every declared meter with its limit for `subject`. */
export function resolveLimits(options: BillingOptions, subject: LimitSubject): UsageLimits {
  return Object.fromEntries(getDeclaredMeters(options).map((meter) => [meter, resolveLimit(options, subject, meter)]));
}

export interface UsagePeriodBounds {
  /** The first instant of the period. */
  readonly start: Date;
  /** The first instant of the next one. */
  readonly end: Date;
}

/** The period `now` falls in: the calendar month in `timezone`, from the start of its 1st. */
export function getUsagePeriod(now: Date, timezone: string, period: UsagePeriod): UsagePeriodBounds {
  switch (period) {
    case "month": {
      const firstDay = `${toCalendarDay(now, timezone).slice(0, 7)}-01`;
      return { start: getStartOfDay(toDayNumber(firstDay), timezone), end: getStartOfDay(toDayNumber(addCalendarMonths(firstDay, 1)), timezone) };
    }
  }
}

function toDayNumber(day: string): number {
  const dayNumber = parseDay(day);
  // Core returns well-formed days only, so reaching here is a bug.
  if (dayNumber === null) throw new Error(`getUsagePeriod: "${day}" is not a calendar day`);
  return dayNumber;
}

export interface UsageStateInput {
  readonly meter: string;
  readonly period: UsagePeriod;
  readonly used: number;
  readonly limit: number | null;
  readonly bounds: UsagePeriodBounds;
}

/** The state of one meter as callers see it. */
export function getUsageState(input: UsageStateInput): UsageState {
  return {
    meter: input.meter,
    period: input.period,
    used: input.used,
    limit: input.limit,
    remaining: input.limit === null ? null : Math.max(0, input.limit - input.used),
    periodStart: input.bounds.start,
    resetsAt: input.bounds.end,
  };
}
