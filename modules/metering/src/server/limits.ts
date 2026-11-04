// Budget limits changed at runtime. The configuration declares which budgets exist (provider, period, scope) and their
// default limit; a row of `metering.budget_limits` overrides the number until it is cleared. Writes take the provider's
// advisory lock, the same one a reservation holds, so a change and a reservation never interleave.
import { err, ok, type Err, type ModuleContext, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, asc, eq, sql } from "drizzle-orm";
import type { BudgetKey, BudgetLimit, BudgetPeriod } from "../contract.js";
import type { BudgetDefinition, ProviderDefinition } from "../options.js";
import { budgetLimits } from "../schema.js";
import { getProviderDefinition } from "./options.js";

type LimitsContext = ModuleContext<Queryable>;

/** `numeric(24, 8)` holds up to 16 digits before the point. */
const MAX_LIMIT = 1e15;
const MAX_UPDATED_BY_LENGTH = 200;

export interface SetBudgetLimitInput extends BudgetKey {
  /** The new limit in the provider's unit, from 0 (the provider is stopped) to 1e15. */
  readonly limit: number;
  /** The account id of whoever changed it, kept for the settings form and cleared when the account is deleted. */
  readonly updatedBy?: string;
}

/** A stored limit as read from the table. */
export interface StoredBudgetLimit {
  readonly limit: number;
  readonly updatedAt: Date;
  readonly updatedBy: string | null;
}

/** Stored limits of one provider, by `getBudgetLimitKey`. */
export type StoredBudgetLimits = ReadonlyMap<string, StoredBudgetLimit>;

/**
 * Stores `limit` for a declared budget, replacing the configured one until `clearBudgetLimit`. Returns the budget's
 * new state, or `metering.invalid_budget_limit` for a limit that is negative, not finite or above 1e15 (an operator's
 * input). Throws for an undeclared provider or budget, and an `updatedBy` that is empty or longer than 200 characters:
 * those are bugs.
 */
export async function setBudgetLimit(ctx: LimitsContext, input: SetBudgetLimitInput): Promise<Ok<BudgetLimit> | Err<"metering.invalid_budget_limit">> {
  const { provider, budget } = resolveDeclaredBudget(ctx, "setBudgetLimit", input);
  if (!Number.isFinite(input.limit) || input.limit < 0 || input.limit > MAX_LIMIT) return err("metering.invalid_budget_limit");
  if (input.updatedBy !== undefined && (input.updatedBy.length === 0 || input.updatedBy.length > MAX_UPDATED_BY_LENGTH)) {
    throw new RangeError(`setBudgetLimit: updatedBy must be 1 to ${String(MAX_UPDATED_BY_LENGTH)} characters`);
  }
  const now = ctx.clock.now();
  const stored = await ctx.db.transaction(async (tx: Queryable): Promise<StoredBudgetLimit> => {
    await lockProviderBudgets(tx, provider.id);
    const values = { limit: String(input.limit), updatedAt: now, updatedBy: input.updatedBy ?? null };
    const [row] = await tx
      .insert(budgetLimits)
      .values({ provider: provider.id, period: budget.period, perAccount: budget.perAccount, ...values })
      .onConflictDoUpdate({ target: [budgetLimits.provider, budgetLimits.period, budgetLimits.perAccount], set: values })
      .returning({ limit: budgetLimits.limit, updatedAt: budgetLimits.updatedAt, updatedBy: budgetLimits.updatedBy });
    // An upsert with returning yields its row.
    if (row === undefined) throw new Error("setBudgetLimit: the budget limit upsert returned no row");
    return { limit: Number(row.limit), updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  });
  return ok(toBudgetLimit(provider, budget, stored));
}

/** Drops a declared budget's stored limit, so the configured one applies again. Returns the budget's new state. */
export async function clearBudgetLimit(ctx: LimitsContext, key: BudgetKey): Promise<Ok<BudgetLimit>> {
  const { provider, budget } = resolveDeclaredBudget(ctx, "clearBudgetLimit", key);
  await ctx.db.transaction(async (tx: Queryable) => {
    await lockProviderBudgets(tx, provider.id);
    await tx
      .delete(budgetLimits)
      .where(and(eq(budgetLimits.provider, provider.id), eq(budgetLimits.period, budget.period), eq(budgetLimits.perAccount, budget.perAccount)));
  });
  return ok(toBudgetLimit(provider, budget, undefined));
}

/**
 * Every budget the provider declares, in configuration order, with its configured default, the stored value and who
 * changed it: what an app's settings form shows. Throws for an undeclared provider.
 */
export async function getBudgetLimits(ctx: LimitsContext, query: { readonly provider: string }): Promise<Ok<readonly BudgetLimit[]>> {
  const provider = getProviderDefinition(ctx.config, query.provider);
  const stored = provider.budgets.length === 0 ? new Map<string, StoredBudgetLimit>() : await readStoredBudgetLimits(ctx.db, provider.id);
  return ok(provider.budgets.map((budget) => toBudgetLimit(provider, budget, stored.get(getBudgetLimitKey(budget.period, budget.perAccount)))));
}

/** Serializes budget checks and limit changes of one provider; runs inside the caller's transaction. */
export async function lockProviderBudgets(tx: Queryable, providerId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`metering:${providerId}`}, 0))`);
}

/** The stored limits of one provider, by budget key. Rows of budgets the configuration no longer declares are read too and ignored by callers. */
export async function readStoredBudgetLimits(db: Queryable, providerId: string): Promise<StoredBudgetLimits> {
  const rows = await db
    .select({ period: budgetLimits.period, perAccount: budgetLimits.perAccount, limit: budgetLimits.limit, updatedAt: budgetLimits.updatedAt, updatedBy: budgetLimits.updatedBy })
    .from(budgetLimits)
    .where(eq(budgetLimits.provider, providerId))
    .orderBy(asc(budgetLimits.period), asc(budgetLimits.perAccount));
  return new Map(rows.map((row) => [getBudgetLimitKey(row.period, row.perAccount), { limit: Number(row.limit), updatedAt: row.updatedAt, updatedBy: row.updatedBy }]));
}

export function getBudgetLimitKey(period: BudgetPeriod, perAccount: boolean): string {
  return `${period}:${String(perAccount)}`;
}

/** The limit in force for a declared budget: the stored one, or the configured one. */
export function getEffectiveLimit(budget: BudgetDefinition, stored: StoredBudgetLimits): number {
  return stored.get(getBudgetLimitKey(budget.period, budget.perAccount))?.limit ?? budget.limit;
}

function resolveDeclaredBudget(ctx: LimitsContext, operation: string, key: BudgetKey): { readonly provider: ProviderDefinition; readonly budget: BudgetDefinition } {
  const provider = getProviderDefinition(ctx.config, key.provider);
  const perAccount = key.perAccount ?? false;
  const budget = provider.budgets.find((candidate) => candidate.period === key.period && candidate.perAccount === perAccount);
  if (budget === undefined) {
    const scope = perAccount ? "per account" : "for the whole provider";
    throw new Error(`${operation}: provider "${provider.id}" declares no ${key.period} budget ${scope}; add it to metering({ providers }) in softure.config.ts`);
  }
  return { provider, budget };
}

function toBudgetLimit(provider: ProviderDefinition, budget: BudgetDefinition, stored: StoredBudgetLimit | undefined): BudgetLimit {
  return {
    provider: provider.id,
    unit: provider.unit,
    period: budget.period,
    perAccount: budget.perAccount,
    configuredLimit: budget.limit,
    storedLimit: stored?.limit ?? null,
    limit: stored?.limit ?? budget.limit,
    updatedAt: stored?.updatedAt ?? null,
    updatedBy: stored?.updatedBy ?? null,
  };
}
