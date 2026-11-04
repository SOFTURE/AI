// The spend ledger: reservations that hold budget while a paid call runs, settled charges, and the spend of a
// period. Budget checks run in SQL `numeric`, so decimal amounts compare exactly, inside one transaction under the
// provider's advisory lock, so two reservations started together cannot both pass the same remaining amount.
import { err, ok, type ModuleContext, type Ok, type Err } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, eq, sql, type SQL } from "drizzle-orm";
import type {
  BudgetExceeded,
  BudgetPeriod,
  BudgetScope,
  BudgetState,
  SpendBreakdown,
  SpendBreakdownRow,
  SpendFilter,
  SpendGroupBy,
  SpendReservation,
  SpendSummary,
} from "../contract.js";
import type { BudgetDefinition, ProviderDefinition } from "../options.js";
import { charges } from "../schema.js";
import { getEffectiveLimit, lockProviderBudgets, readStoredBudgetLimits } from "./limits.js";
import { getMeteringOptions, getProviderDefinition } from "./options.js";
import { getPeriodBounds } from "./periods.js";

export type MeteringContext = ModuleContext<Queryable>;

/** The app's own string attributes stored with a charge, e.g. `{ jobId }`. */
export type ChargeAttributes = Readonly<Record<string, string>>;

/** `numeric(24, 8)` holds up to 16 digits before the point. */
const MAX_AMOUNT = 1e15;
const MAX_STEP_LENGTH = 100;
const MAX_ACCOUNT_ID_LENGTH = 200;
const MAX_ATTRIBUTE_LENGTH = 100;
const MAX_ATTRIBUTE_VALUE_LENGTH = 500;

export interface SpendInput {
  /** A provider declared in `metering({ providers })`. */
  readonly provider: string;
  /** In the provider's unit; at least 0. */
  readonly amount: number;
  /** What the call is for, e.g. `transcribe` or a model id. */
  readonly step?: string;
  /** The account the spend belongs to; required when the provider has a per-account budget. */
  readonly accountId?: string;
  readonly attributes?: ChargeAttributes;
}

export interface ChargeInput extends SpendInput {
  /** When the call was billed; the clock's now by default. */
  readonly at?: Date;
}

export interface SpendQuery {
  readonly provider: string;
  readonly period: BudgetPeriod;
  /** The account's spend and its per-account budget; without it, the whole provider's. */
  readonly accountId?: string;
  /** Only the charges whose attribute has this value, e.g. one item's spend. The budget fields stay the scope's. */
  readonly filter?: SpendFilter;
}

export interface SpendBreakdownQuery extends SpendQuery {
  /** Rows per `step`, or per value of one attribute. */
  readonly groupBy: SpendGroupBy;
}

/**
 * Holds `amount` of every budget that applies (the provider's, and the account's when `accountId` is given) until
 * `settleSpend` or `releaseSpend`, or until it expires. Refuses with `metering.budget_exceeded` and the first budget
 * the amount does not fit. Throws for an undeclared provider, an invalid amount, or a per-account budget without
 * `accountId`: those are bugs.
 */
export async function reserveSpend(ctx: MeteringContext, input: SpendInput): Promise<Ok<SpendReservation> | BudgetExceeded> {
  const provider = getProviderDefinition(ctx.config, input.provider);
  assertSpendInput("reserveSpend", provider, input);
  const budgets = getApplyingBudgets("reserveSpend", provider, input.accountId);
  const now = ctx.clock.now();
  const expiresAt = new Date(now.getTime() + getMeteringOptions(ctx.config).reservationTtlSeconds * 1000);

  return ctx.db.transaction(async (tx: Queryable): Promise<Ok<SpendReservation> | BudgetExceeded> => {
    if (budgets.length > 0) {
      await lockProviderBudgets(tx, provider.id);
      // Read after the lock, so a limit changed by setBudgetLimit applies to every check of this reservation or none.
      const stored = await readStoredBudgetLimits(tx, provider.id);
      for (const budget of budgets) {
        const limit = getEffectiveLimit(budget, stored);
        const state = await readBudgetState(tx, { provider, budget, limit, accountId: input.accountId, now, timeZone: ctx.config.timezone, adding: input.amount });
        if (state.isOver) return { ...err("metering.budget_exceeded"), budget: state.budget, requested: input.amount };
      }
    }
    const [row] = await tx
      .insert(charges)
      .values({
        provider: provider.id,
        step: input.step ?? null,
        unit: provider.unit,
        amount: String(input.amount),
        accountId: input.accountId ?? null,
        attributes: { ...input.attributes },
        status: "reserved",
        createdAt: now,
        expiresAt,
      })
      .returning({ id: charges.id, amount: charges.amount });
    // An insert with returning yields its row.
    if (row === undefined) throw new Error("reserveSpend: the reservation insert returned no row");
    return ok({ id: row.id, provider: provider.id, unit: provider.unit, amount: Number(row.amount), accountId: input.accountId ?? null, createdAt: now, expiresAt });
  });
}

/**
 * Turns a reservation into the charge the provider billed, `actual` in the provider's unit (above the reserved
 * amount too: the ledger records what was billed). `metering.reservation_not_found` when it was already settled,
 * released, or pruned after expiring.
 */
export async function settleSpend(
  ctx: MeteringContext,
  reservation: Pick<SpendReservation, "id">,
  actual: number,
): Promise<Ok<undefined> | Err<"metering.reservation_not_found">> {
  assertAmount("settleSpend", actual);
  const settled = await ctx.db
    .update(charges)
    .set({ status: "settled", amount: String(actual), expiresAt: null, settledAt: ctx.clock.now() })
    .where(and(eq(charges.id, reservation.id), eq(charges.status, "reserved")))
    .returning({ id: charges.id });
  return settled.length === 0 ? err("metering.reservation_not_found") : ok();
}

/** Gives a reservation's budget back after a call that was not billed (it failed before the provider charged). */
export async function releaseSpend(
  ctx: MeteringContext,
  reservation: Pick<SpendReservation, "id">,
): Promise<Ok<undefined> | Err<"metering.reservation_not_found">> {
  const released = await ctx.db
    .delete(charges)
    .where(and(eq(charges.id, reservation.id), eq(charges.status, "reserved")))
    .returning({ id: charges.id });
  return released.length === 0 ? err("metering.reservation_not_found") : ok();
}

/**
 * Records a charge billed without a reservation (reported after the call, e.g. by a usage hook). It is never refused:
 * it already happened. Throws for an undeclared provider or an invalid amount.
 */
export async function recordCharge(ctx: MeteringContext, input: ChargeInput): Promise<Ok<{ readonly id: string }>> {
  const provider = getProviderDefinition(ctx.config, input.provider);
  assertSpendInput("recordCharge", provider, input);
  const now = ctx.clock.now();
  const [row] = await ctx.db
    .insert(charges)
    .values({
      provider: provider.id,
      step: input.step ?? null,
      unit: provider.unit,
      amount: String(input.amount),
      accountId: input.accountId ?? null,
      attributes: { ...input.attributes },
      status: "settled",
      createdAt: input.at ?? now,
      settledAt: now,
    })
    .returning({ id: charges.id });
  // An insert with returning yields its row.
  if (row === undefined) throw new Error("recordCharge: the charge insert returned no row");
  return ok({ id: row.id });
}

/**
 * The provider's (or the account's) spend in the current day or month and the budget that limits it, if any: the
 * limit stored by `setBudgetLimit`, or the configured one.
 */
export async function getSpend(ctx: MeteringContext, query: SpendQuery): Promise<Ok<SpendSummary>> {
  const scope = resolveSpendScope(ctx, "getSpend", query);
  const budget = scope.provider.budgets.find((candidate) => candidate.period === query.period && candidate.perAccount === (query.accountId !== undefined));
  const limit = budget === undefined ? null : getEffectiveLimit(budget, await readStoredBudgetLimits(ctx.db, scope.provider.id));
  const totals = await sumSpend(ctx.db, { ...scope.sum, limit, adding: 0 });
  return ok({
    provider: scope.provider.id,
    unit: scope.provider.unit,
    period: query.period,
    accountId: query.accountId ?? null,
    from: scope.sum.from,
    resetsAt: scope.sum.to,
    settled: totals.settled,
    reserved: totals.reserved,
    spent: totals.spent,
    limit,
    remaining: totals.remaining,
  });
}

/**
 * The provider's (or the account's) spend in the current day or month per step or per value of one attribute, e.g.
 * `groupBy: { attribute: "jobId" }` for the cost of each item. Charges without the step or the attribute form the row
 * with `key: null`, so the rows add up to `getSpend` of the same query. Throws for an undeclared provider or an
 * invalid attribute name or value: those are bugs.
 */
export async function getSpendBreakdown(ctx: MeteringContext, query: SpendBreakdownQuery): Promise<Ok<SpendBreakdown>> {
  const scope = resolveSpendScope(ctx, "getSpendBreakdown", query);
  if (query.groupBy !== "step") assertAttributeName("getSpendBreakdown", query.groupBy.attribute);
  const key = query.groupBy === "step" ? sql`step` : sql`attributes ->> ${query.groupBy.attribute}`;
  const result = await ctx.db.execute<{ key: string | null; settled: string; reserved: string; spent: string }>(sql`
    with totals as (
      select
        ${key} as key,
        coalesce(sum(amount) filter (where status = 'settled'), 0) as settled,
        coalesce(sum(amount) filter (where status = 'reserved'), 0) as reserved
      from metering.charges
      where ${getSpendConditions(scope.sum)}
      group by 1
    )
    select key, settled::text as settled, reserved::text as reserved, (settled + reserved)::text as spent
    from totals
    order by settled + reserved desc, key asc nulls last`);
  const rows = result.rows.map(
    (row): SpendBreakdownRow => ({ key: row.key, settled: Number(row.settled), reserved: Number(row.reserved), spent: Number(row.spent) }),
  );
  return ok({
    provider: scope.provider.id,
    unit: scope.provider.unit,
    period: query.period,
    accountId: query.accountId ?? null,
    groupBy: query.groupBy,
    filter: query.filter ?? null,
    from: scope.sum.from,
    resetsAt: scope.sum.to,
    rows,
  });
}

interface SpendScope {
  readonly provider: ProviderDefinition;
  readonly sum: Omit<SpendSum, "limit" | "adding">;
}

function resolveSpendScope(ctx: MeteringContext, operation: string, query: SpendQuery): SpendScope {
  const provider = getProviderDefinition(ctx.config, query.provider);
  if (query.accountId !== undefined) assertAccountId(operation, query.accountId);
  if (query.filter !== undefined) assertFilter(operation, query.filter);
  const now = ctx.clock.now();
  const bounds = getPeriodBounds(query.period, now, ctx.config.timezone);
  return { provider, sum: { providerId: provider.id, accountId: query.accountId, filter: query.filter, from: bounds.from, to: bounds.resetsAt, now } };
}

interface BudgetCheck {
  readonly provider: ProviderDefinition;
  readonly budget: BudgetDefinition;
  /** The limit in force: stored at runtime or configured. */
  readonly limit: number;
  readonly accountId: string | undefined;
  readonly now: Date;
  readonly timeZone: string;
  readonly adding: number;
}

async function readBudgetState(tx: Queryable, check: BudgetCheck): Promise<{ readonly budget: BudgetState; readonly isOver: boolean }> {
  const bounds = getPeriodBounds(check.budget.period, check.now, check.timeZone);
  const accountId = check.budget.perAccount ? check.accountId : undefined;
  const totals = await sumSpend(tx, { providerId: check.provider.id, accountId, from: bounds.from, to: bounds.resetsAt, now: check.now, limit: check.limit, adding: check.adding });
  const scope: BudgetScope = accountId === undefined ? { kind: "provider" } : { kind: "account", accountId };
  return {
    isOver: totals.isOver,
    budget: {
      provider: check.provider.id,
      unit: check.provider.unit,
      period: check.budget.period,
      scope,
      limit: check.limit,
      spent: totals.spent,
      remaining: totals.remaining ?? 0,
      resetsAt: bounds.resetsAt,
    },
  };
}

interface SpendSum {
  readonly providerId: string;
  readonly accountId: string | undefined;
  readonly filter?: SpendFilter | undefined;
  readonly from: Date;
  readonly to: Date;
  readonly now: Date;
  readonly limit: number | null;
  /** The amount a reservation would add; the check is `spent + adding > limit`. */
  readonly adding: number;
}

interface SpendTotals {
  readonly settled: number;
  readonly reserved: number;
  readonly spent: number;
  readonly remaining: number | null;
  readonly isOver: boolean;
}

/** The charges that count in a period: settled ones and unexpired reservations of the provider (and account). */
function getSpendConditions(input: Omit<SpendSum, "limit" | "adding">): SQL {
  const conditions: SQL[] = [
    sql`provider = ${input.providerId}`,
    sql`created_at >= ${input.from.toISOString()}::timestamptz`,
    sql`created_at < ${input.to.toISOString()}::timestamptz`,
    sql`(status = 'settled' or expires_at > ${input.now.toISOString()}::timestamptz)`,
  ];
  if (input.accountId !== undefined) conditions.push(sql`account_id = ${input.accountId}`);
  // Containment, not `->>` equality, so the GIN index of migration 0002 serves it for any attribute.
  if (input.filter !== undefined) conditions.push(sql`attributes @> jsonb_build_object(${input.filter.attribute}::text, ${input.filter.value}::text)`);
  return sql.join(conditions, sql` and `);
}

async function sumSpend(db: Queryable, input: SpendSum): Promise<SpendTotals> {
  const limit = input.limit === null ? sql`null::numeric` : sql`${String(input.limit)}::numeric`;
  // `greatest` skips nulls, so without a limit the remaining amount is null explicitly.
  const remaining = input.limit === null ? sql`null::text` : sql`greatest(${limit} - (settled + reserved), 0)::text`;
  const result = await db.execute<{ settled: string; reserved: string; spent: string; remaining: string | null; is_over: boolean | null }>(sql`
    with totals as (
      select
        coalesce(sum(amount) filter (where status = 'settled'), 0) as settled,
        coalesce(sum(amount) filter (where status = 'reserved'), 0) as reserved
      from metering.charges
      where ${getSpendConditions(input)}
    )
    select
      settled::text as settled,
      reserved::text as reserved,
      (settled + reserved)::text as spent,
      ${remaining} as remaining,
      (settled + reserved + ${String(input.adding)}::numeric) > ${limit} as is_over
    from totals`);
  const [row] = result.rows;
  // An aggregate without group by always yields one row.
  if (row === undefined) throw new Error("sumSpend: the spend query returned no row");
  return {
    settled: Number(row.settled),
    reserved: Number(row.reserved),
    spent: Number(row.spent),
    remaining: row.remaining === null ? null : Number(row.remaining),
    isOver: row.is_over === true,
  };
}

function getApplyingBudgets(operation: string, provider: ProviderDefinition, accountId: string | undefined): readonly BudgetDefinition[] {
  const perAccount = provider.budgets.filter((budget) => budget.perAccount);
  if (perAccount.length > 0 && accountId === undefined) {
    throw new Error(`${operation}: provider "${provider.id}" has a per-account budget, so every reservation names its accountId`);
  }
  return provider.budgets;
}

function assertSpendInput(operation: string, provider: ProviderDefinition, input: SpendInput): void {
  assertAmount(operation, input.amount);
  if (input.step !== undefined && (input.step.length === 0 || input.step.length > MAX_STEP_LENGTH)) {
    throw new RangeError(`${operation}: step of provider "${provider.id}" must be 1 to ${String(MAX_STEP_LENGTH)} characters`);
  }
  if (input.accountId !== undefined) assertAccountId(operation, input.accountId);
}

function assertAmount(operation: string, amount: number): void {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
    throw new RangeError(`${operation}: amount must be a finite number from 0 to ${String(MAX_AMOUNT)}, got ${String(amount)}`);
  }
}

function assertAccountId(operation: string, accountId: string): void {
  if (accountId.length === 0 || accountId.length > MAX_ACCOUNT_ID_LENGTH) {
    throw new RangeError(`${operation}: accountId must be 1 to ${String(MAX_ACCOUNT_ID_LENGTH)} characters`);
  }
}

function assertFilter(operation: string, filter: SpendFilter): void {
  assertAttributeName(operation, filter.attribute);
  if (filter.value.length === 0 || filter.value.length > MAX_ATTRIBUTE_VALUE_LENGTH) {
    throw new RangeError(`${operation}: the value of attribute "${filter.attribute}" must be 1 to ${String(MAX_ATTRIBUTE_VALUE_LENGTH)} characters`);
  }
}

function assertAttributeName(operation: string, attribute: string): void {
  if (attribute.length === 0 || attribute.length > MAX_ATTRIBUTE_LENGTH) {
    throw new RangeError(`${operation}: attribute must be 1 to ${String(MAX_ATTRIBUTE_LENGTH)} characters`);
  }
}
