// The SQL surface for an app's own queries (migrations 0012 and 0013): `billing.entitlement_states`
// with the trial policy and the free tier of the running app filled in, so SQL built in TypeScript never copies the
// configuration that the derived trial depends on.
import { sql, type SQL } from "drizzle-orm";
import { getBillingOptions } from "./options.js";
import type { BillingContext } from "./entitlements.js";

/**
 * `billing.entitlement_states(...)` at `asOf` (the context's clock when absent) for the app's
 * `trial.days`, `trial.startsAt`, time zone and free tier (`free`), to use as a table: one row per
 * account with `user_id`, `status`, `ends_at`, `read_only_since`, `read_only_reason`,
 * `trial_ends_at`, `paid_until`, `is_lifetime`, `is_stored`, `free_since` and `free_reason`. It
 * agrees with `getEntitlement`.
 *
 * ```ts
 * const states = getEntitlementStatesSql(ctx);
 * await ctx.db.execute(sql`select s.user_id from ${states} s where s.status = 'read_only' and s.paid_until is null`);
 * ```
 */
export function getEntitlementStatesSql(ctx: Pick<BillingContext, "config" | "clock">, asOf: Date = ctx.clock.now()): SQL {
  const options = getBillingOptions(ctx.config);
  const { days, startsAt } = options.trial;
  const hasFreeTier = options.free !== undefined;
  return sql`billing.entitlement_states(${asOf.toISOString()}::timestamptz, ${days}::integer, ${ctx.config.timezone}::text, ${startsAt ?? null}::date, ${hasFreeTier}::boolean)`;
}
