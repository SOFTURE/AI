// The usage ledger: how much of a meter an account used in the current period, and consuming quota
// atomically. A consumption is one conditional upsert on the account's row for the meter and the
// period, so concurrent consumers serialise on that row and the count never passes the limit. Called
// with a transaction's context (`{ ...ctx, db: tx }`), the consumption commits or rolls back with the
// app's own write.
import { users } from "@softure-ai/auth";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, eq, sql } from "drizzle-orm";
import type { UsagePeriod, UsageState } from "../contract.js";
import { resolveEntitlement } from "../entitlement.js";
import { MAX_USAGE_LIMIT } from "../options.js";
import { getUsagePeriod, getUsageState, isDeclaredMeter, resolveLimit, type UsagePeriodBounds } from "../usage.js";
import { usage } from "../schema.js";
import { findEntitlementRecord, type BillingContext } from "./entitlements.js";
import { findCurrentPlanId } from "./limits.js";
import { getBillingOptions, getEntitlementPolicy } from "./options.js";
import { isUserId } from "./user-id.js";

export interface GetUsageInput {
  readonly userId: string;
  /** A meter some limits block of the config declares. */
  readonly meter: string;
  /** `month` (the default): the calendar month in the app's time zone. */
  readonly period?: UsagePeriod;
}

export interface ConsumeUsageInput extends GetUsageInput {
  /** How much to consume, a whole number from 1; 1 by default. */
  readonly amount?: number;
}

/** A refused consumption, with the meter's state as it stands (nothing was consumed). */
export interface QuotaExhausted extends Err<"billing.quota_exhausted"> {
  readonly usage: UsageState;
}

/** Refuses a meter the config does not declare: calling with one is a bug in the app. */
function assertDeclaredMeter(ctx: Pick<BillingContext, "config">, meter: string): void {
  if (!isDeclaredMeter(getBillingOptions(ctx.config), meter)) {
    throw new Error(`@softure-ai/billing: the meter "${meter}" is in no limits block of billing({ ... }); declare it in trial, paid, readOnly or a plan`);
  }
}

/** The account's limit of `meter` at `now`, or undefined when no account has this id. */
async function findMeterLimit(ctx: Pick<BillingContext, "db" | "config">, userId: string, meter: string, now: Date): Promise<number | null | undefined> {
  const record = await findEntitlementRecord(ctx, userId);
  if (record === null) return undefined;
  const { status } = resolveEntitlement(record, now, getEntitlementPolicy(ctx.config));
  const planId = status === "paid" ? await findCurrentPlanId(ctx.db, userId, now) : null;
  return resolveLimit(getBillingOptions(ctx.config), { status, planId }, meter);
}

interface UsageKey {
  readonly userId: string;
  readonly meter: string;
  readonly period: UsagePeriod;
  readonly bounds: UsagePeriodBounds;
}

/** What the account used of the meter in the period; 0 without a row. */
async function readUsed(ctx: Pick<BillingContext, "db">, key: UsageKey): Promise<number> {
  const [row] = await ctx.db
    .select({ used: usage.used })
    .from(usage)
    .where(and(eq(usage.userId, key.userId), eq(usage.meter, key.meter), eq(usage.period, key.period), eq(usage.periodStart, key.bounds.start)));
  return row?.used ?? 0;
}

/**
 * The account's usage of `meter` in the current period, its limit and when the count starts again;
 * `billing.account_unknown` without an account. An undeclared meter throws. Reads only.
 */
export async function getUsage(ctx: BillingContext, input: GetUsageInput): Promise<Ok<UsageState> | Err<"billing.account_unknown">> {
  assertDeclaredMeter(ctx, input.meter);
  if (!isUserId(input.userId)) return err("billing.account_unknown");
  const now = ctx.clock.now();
  const period = input.period ?? "month";
  const limit = await findMeterLimit(ctx, input.userId, input.meter, now);
  if (limit === undefined) return err("billing.account_unknown");
  const key = { userId: input.userId, meter: input.meter, period, bounds: getUsagePeriod(now, ctx.config.timezone, period) };
  return ok(getUsageState({ ...key, used: await readUsed(ctx, key), limit }));
}

/**
 * Consumes `amount` of `meter` for the account in the current period: `Ok` with the state after it,
 * or `billing.quota_exhausted` with the state as it stands when the amount would pass the limit (the
 * limit of the account's state and plan now; a lower limit after a plan change refuses until the next
 * period). `billing.account_unknown` without an account. Atomic per account and meter under any
 * concurrency. An undeclared meter or an amount that is not a whole number from 1 throws (a bug).
 * Database errors propagate.
 */
export async function consumeUsage(ctx: BillingContext, input: ConsumeUsageInput): Promise<Ok<UsageState> | QuotaExhausted | Err<"billing.account_unknown">> {
  assertDeclaredMeter(ctx, input.meter);
  const amount = input.amount ?? 1;
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_USAGE_LIMIT) {
    throw new Error(`@softure-ai/billing: consumeUsage amount must be a whole number from 1 to ${String(MAX_USAGE_LIMIT)}, got ${String(amount)}`);
  }
  if (!isUserId(input.userId)) return err("billing.account_unknown");
  const { userId, meter } = input;
  const period = input.period ?? "month";
  return ctx.db.transaction(async (tx) => {
    const txCtx = { ...ctx, db: tx };
    const now = ctx.clock.now();
    // A shared lock: the account cannot be deleted before the upsert below.
    const [account] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("key share");
    if (account === undefined) return err("billing.account_unknown");
    const limit = await findMeterLimit(txCtx, userId, meter, now);
    if (limit === undefined) return err("billing.account_unknown");
    const key = { userId, meter, period, bounds: getUsagePeriod(now, ctx.config.timezone, period) };
    const refuse = async (): Promise<QuotaExhausted> => ({ ...err("billing.quota_exhausted"), usage: getUsageState({ ...key, used: await readUsed(txCtx, key), limit }) });
    if (limit !== null && amount > limit) return refuse();
    // On a conflict the row is locked and the condition reads its latest version, so two consumers
    // of the last unit cannot both pass.
    const [row] = await tx
      .insert(usage)
      .values({ userId, meter, period, periodStart: key.bounds.start, used: amount, updatedAt: now })
      .onConflictDoUpdate({
        target: [usage.userId, usage.meter, usage.period, usage.periodStart],
        set: { used: sql`${usage.used} + excluded.used`, updatedAt: sql`excluded.updated_at` },
        setWhere: limit === null ? undefined : sql`${usage.used} + excluded.used <= ${limit}`,
      })
      .returning();
    if (row === undefined) return refuse();
    return ok(getUsageState({ ...key, used: row.used, limit }));
  });
}
