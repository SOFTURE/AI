// The SQL surface for an app's own queries (migration 0012): `billing.entitlement_states` with the
// trial policy of the running app filled in, so SQL built in TypeScript never copies the
// configuration that the derived trial depends on.
import { sql, type SQL } from "drizzle-orm";
import { getBillingOptions } from "./options.js";
import type { BillingContext } from "./entitlements.js";

/**
 * `billing.entitlement_states(...)` at `asOf` (the context's clock when absent) for the app's
 * `trial.days`, `trial.startsAt` and time zone, to use as a table: one row per account with
 * `user_id`, `status`, `ends_at`, `read_only_since`, `read_only_reason`, `trial_ends_at`,
 * `paid_until`, `is_lifetime` and `is_stored`. It agrees with `getEntitlement`.
 *
 * ```ts
 * const states = getEntitlementStatesSql(ctx);
 * await ctx.db.execute(sql`select s.user_id from ${states} s where s.status = 'read_only' and s.paid_until is null`);
 * ```
 */
export function getEntitlementStatesSql(ctx: Pick<BillingContext, "config" | "clock">, asOf: Date = ctx.clock.now()): SQL {
  const { days, startsAt } = getBillingOptions(ctx.config).trial;
  return sql`billing.entitlement_states(${asOf.toISOString()}::timestamptz, ${days}::integer, ${ctx.config.timezone}::text, ${startsAt ?? null}::date)`;
}
