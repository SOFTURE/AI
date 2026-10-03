// The funnel counter (FIRE_TRACKER `src/db/funnel-counts.ts` and `scripts/kanaly-report.sql`,
// generalised): daily aggregates per (day, channel, step), with the steps, the cap on new channels
// and the time zone from configuration. Nothing about a visitor is stored, only the sums.
import { errorLogLabel, type ModuleContext } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { OVERFLOW_CHANNEL, type FunnelStep, type FunnelStepSource } from "../options.js";
import { funnelCounts } from "../schema.js";
import { parseChannel } from "./channel.js";
import { getAnalyticsOptions } from "./options.js";

export type AnalyticsContext = ModuleContext<Queryable>;

/** Where a count in the report comes from. */
export type FunnelChannel =
  | { readonly kind: "tagged"; readonly channel: string }
  | { readonly kind: "untagged" }
  | { readonly kind: "overflow" };

export interface FunnelReportRow {
  readonly channel: FunnelChannel;
  /** Visits that reached each configured step, by step id; 0 for none. */
  readonly counts: Readonly<Record<string, number>>;
}

export interface FunnelReport {
  /** The first and last day of the window, `YYYY-MM-DD` in the app's time zone. */
  readonly from: string;
  readonly to: string;
  /** The configured step ids, in funnel order: the report's columns. */
  readonly steps: readonly string[];
  /** One row per channel seen in the window, the busiest first (by the steps in order). */
  readonly rows: readonly FunnelReportRow[];
  /** The sum of every row per step. */
  readonly total: Readonly<Record<string, number>>;
}

export interface RecordFunnelStepInput {
  /** A step id from `analytics({ funnel: { steps } })`. */
  readonly step: string;
  /** The visit's channel (`getChannel()`, `readChannel()`), or null without one. */
  readonly channel: string | null;
}

/** The longest window a report reads: ten years of days. */
export const MAX_REPORT_DAYS = 3660;
const DAY_MS = 86_400_000;

/**
 * Adds one visit to `step` from `channel` on today's date in the app's time zone.
 *
 * One statement: choosing the channel's key (its own name or `OVERFLOW_CHANNEL`) and the increment
 * happen in one `INSERT … ON CONFLICT DO UPDATE`, so parallel visits never lose each other. A race
 * at the cap may let a few channels past it; the cap bounds growth, it is not an exact quota.
 * A channel counted before (today or on an earlier day) is never capped, nor is "no channel".
 *
 * Throws for a step the funnel does not declare (a bug in the caller); an invalid channel counts as
 * none, as everywhere else in the module. Database failures propagate.
 */
export async function recordFunnelStep(ctx: AnalyticsContext, input: RecordFunnelStepInput): Promise<void> {
  const options = getAnalyticsOptions(ctx.config);
  assertStep(options.funnel.steps, input.step);
  const channel = parseChannel(input.channel, options.channel) ?? "";
  const day = formatDay(ctx.clock.now(), ctx.config.timezone);

  const key = sql`case
    when ${channel}::text = ''
      or exists (select 1 from ${funnelCounts} as known where known.channel = ${channel}::text and known.day <= ${day}::date)
      or (
        select count(distinct today.channel) from ${funnelCounts} as today
        where today.day = ${day}::date and today.channel not in ('', ${OVERFLOW_CHANNEL}::text)
      ) < ${options.funnel.channelCap}::integer
    then ${channel}::text
    else ${OVERFLOW_CHANNEL}::text
  end`;

  await ctx.db
    .insert(funnelCounts)
    .values({ day, channel: key, step: input.step, count: 1 })
    .onConflictDoUpdate({
      target: [funnelCounts.day, funnelCounts.channel, funnelCounts.step],
      set: { count: sql`${funnelCounts.count} + 1` },
    });
}

/**
 * The funnel per channel over the last `days` days (today included, default 30) in the app's
 * time zone. Steps no longer configured are left out; counts read like a funnel from left to right.
 */
export async function getFunnelReport(ctx: AnalyticsContext, input: { readonly days?: number } = {}): Promise<FunnelReport> {
  const days = input.days ?? 30;
  if (!Number.isInteger(days) || days < 1 || days > MAX_REPORT_DAYS) {
    throw new RangeError(`getFunnelReport: days must be a whole number from 1 to ${String(MAX_REPORT_DAYS)}, got ${String(days)}`);
  }
  const steps = getAnalyticsOptions(ctx.config).funnel.steps.map((step) => step.id);
  const to = formatDay(ctx.clock.now(), ctx.config.timezone);
  const from = addDays(to, 1 - days);

  const sums =
    steps.length === 0
      ? []
      : await ctx.db
          .select({ channel: funnelCounts.channel, step: funnelCounts.step, total: sql<string>`sum(${funnelCounts.count})::text` })
          .from(funnelCounts)
          .where(and(gte(funnelCounts.day, from), lte(funnelCounts.day, to), inArray(funnelCounts.step, steps)))
          .groupBy(funnelCounts.channel, funnelCounts.step);

  const byChannel = new Map<string, Record<string, number>>();
  for (const sum of sums) {
    const counts = byChannel.get(sum.channel) ?? createEmptyCounts(steps);
    counts[sum.step] = Number(sum.total);
    byChannel.set(sum.channel, counts);
  }

  const rows = [...byChannel.entries()]
    .sort(([channelA, a], [channelB, b]) => compareRows(steps, a, b) || channelA.localeCompare(channelB))
    .map(([channel, counts]) => ({ channel: toFunnelChannel(channel), counts }));
  const total = createEmptyCounts(steps);
  for (const row of rows) for (const step of steps) total[step] = (total[step] ?? 0) + (row.counts[step] ?? 0);
  return { from, to, steps, rows, total };
}

/**
 * Deletes the counts of days before the last `keepDays` days (today included). The counts hold no
 * personal data, so keeping them is the app's choice; call this from a scheduled job to bound them.
 */
export async function pruneFunnelCounts(ctx: AnalyticsContext, input: { readonly keepDays: number }): Promise<void> {
  if (!Number.isInteger(input.keepDays) || input.keepDays < 1) {
    throw new RangeError(`pruneFunnelCounts: keepDays must be a whole number of at least 1, got ${String(input.keepDays)}`);
  }
  const firstKept = addDays(formatDay(ctx.clock.now(), ctx.config.timezone), 1 - input.keepDays);
  await ctx.db.delete(funnelCounts).where(lt(funnelCounts.day, firstKept));
}

/** What a public request may count: a step it is allowed to report, or null when it may not. */
export function findPublicStep(steps: readonly FunnelStep[], id: string | null, via: Exclude<FunnelStepSource, "server">): FunnelStep | null {
  const step = steps.find((candidate) => candidate.id === id);
  return step?.via === via ? step : null;
}

/** Counts a step and turns a database failure into `false` with a log line (for endpoints and hooks that must not fail). */
export async function recordFunnelStepQuietly(ctx: AnalyticsContext, input: RecordFunnelStepInput): Promise<boolean> {
  try {
    await recordFunnelStep(ctx, input);
    return true;
  } catch (error) {
    // The label, not the error: the driver's error carries the query's parameters.
    console.error(`@softure-ai/analytics: counting the funnel step "${input.step}" failed: ${errorLogLabel(error)}`);
    return false;
  }
}

/** `YYYY-MM-DD` of `instant` in `timeZone`, independent of the server's own zone. */
export function formatDay(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function assertStep(steps: readonly FunnelStep[], id: string): void {
  if (!steps.some((step) => step.id === id)) {
    throw new Error(`@softure-ai/analytics: "${id}" is not a step of analytics({ funnel: { steps } })`);
  }
}

function addDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

function createEmptyCounts(steps: readonly string[]): Record<string, number> {
  return Object.fromEntries(steps.map((step) => [step, 0]));
}

/** Busier first: by the first step, then the next one, and so on. */
function compareRows(steps: readonly string[], a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>): number {
  for (const step of steps) {
    const difference = (b[step] ?? 0) - (a[step] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function toFunnelChannel(channel: string): FunnelChannel {
  if (channel === "") return { kind: "untagged" };
  if (channel === OVERFLOW_CHANNEL) return { kind: "overflow" };
  return { kind: "tagged", channel };
}
