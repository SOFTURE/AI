// What a provider really bills per unit for one step, from the ledger's history: the settled charges whose amount
// was the provider's reported cost (`reported: "true"`) and which kept their billed `units`, as the footage recorder
// writes them. An app calibrates an estimate with it instead of the provider's published rate.
import { ok, type Ok } from "@softure-ai/core";
import { sql, type SQL } from "drizzle-orm";
import type { ChargeRate } from "../contract.js";
import { getProviderDefinition } from "./options.js";
import type { MeteringContext } from "./spend.js";

const DEFAULT_LATEST = 20;
const MAX_LATEST = 1000;
const MAX_STEP_LENGTH = 100;
const MAX_ACCOUNT_ID_LENGTH = 200;
/** A decimal as `String(number)` writes it; anything else in `units` is not a unit count and is skipped. */
const UNITS_PATTERN = "^[0-9]+(\\.[0-9]+)?(e[-+]?[0-9]+)?$";

export interface ChargeRateQuery {
  readonly provider: string;
  readonly step: string;
  /** Only this account's charges; every account's without it. */
  readonly accountId?: string;
  /** How many of the newest charges the rate is over; 20 by default, at most 1000. */
  readonly latest?: number;
  /** Below this many units in total the history is too thin and the answer is `null`; 0 by default. */
  readonly minUnits?: number;
}

/**
 * The amount per unit over the latest settled reported charges of a provider's step (and account). `ok(null)` when
 * there are none, or their units add up to less than `minUnits` or to 0. Reservations, fallback-priced charges and
 * charges without numeric `units` do not count. Throws for an undeclared provider or invalid input: those are bugs.
 */
export async function getChargeRate(ctx: MeteringContext, query: ChargeRateQuery): Promise<Ok<ChargeRate | null>> {
  const provider = getProviderDefinition(ctx.config, query.provider);
  const latest = query.latest ?? DEFAULT_LATEST;
  const minUnits = query.minUnits ?? 0;
  assertChargeRateQuery(query, latest, minUnits);
  const conditions: SQL[] = [
    sql`provider = ${provider.id}`,
    sql`step = ${query.step}`,
    sql`status = 'settled'`,
    // Containment, so the GIN index of migration 0002 serves it.
    sql`attributes @> '{"reported":"true"}'::jsonb`,
    sql`attributes ->> 'units' ~ ${UNITS_PATTERN}`,
  ];
  if (query.accountId !== undefined) conditions.push(sql`account_id = ${query.accountId}`);
  const result = await ctx.db.execute<{ charges: number; amount: string; units: string }>(sql`
    with latest as (
      select amount, (attributes ->> 'units')::numeric as units
      from metering.charges
      where ${sql.join(conditions, sql` and `)}
      order by created_at desc, id desc
      limit ${latest}
    )
    select count(*)::int as charges, coalesce(sum(amount), 0)::text as amount, coalesce(sum(units), 0)::text as units
    from latest`);
  const [row] = result.rows;
  // An aggregate without group by always yields one row.
  if (row === undefined) throw new Error("getChargeRate: the rate query returned no row");
  const amount = Number(row.amount);
  const units = Number(row.units);
  if (row.charges === 0 || units === 0 || units < minUnits) return ok(null);
  return ok({
    provider: provider.id,
    unit: provider.unit,
    step: query.step,
    accountId: query.accountId ?? null,
    rate: amount / units,
    amount,
    units,
    charges: row.charges,
  });
}

function assertChargeRateQuery(query: ChargeRateQuery, latest: number, minUnits: number): void {
  if (query.step.length === 0 || query.step.length > MAX_STEP_LENGTH) {
    throw new RangeError(`getChargeRate: step must be 1 to ${String(MAX_STEP_LENGTH)} characters`);
  }
  if (query.accountId !== undefined && (query.accountId.length === 0 || query.accountId.length > MAX_ACCOUNT_ID_LENGTH)) {
    throw new RangeError(`getChargeRate: accountId must be 1 to ${String(MAX_ACCOUNT_ID_LENGTH)} characters`);
  }
  if (!Number.isInteger(latest) || latest < 1 || latest > MAX_LATEST) {
    throw new RangeError(`getChargeRate: latest must be an integer from 1 to ${String(MAX_LATEST)}, got ${String(latest)}`);
  }
  if (!Number.isFinite(minUnits) || minUnits < 0) {
    throw new RangeError(`getChargeRate: minUnits must be a finite number of at least 0, got ${String(minUnits)}`);
  }
}
