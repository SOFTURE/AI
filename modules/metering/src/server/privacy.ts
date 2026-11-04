// The metering part of a GDPR export and deletion (`@softure-ai/privacy`). A charge names the account it belongs
// to (`account_id`), which an app sets to the user id when spend is per user. Deleting the user clears the id and
// the app's attributes and keeps the amounts: they are the app's spend records, and budget totals stay true. Both
// helpers read only `db`, so an app that runs its own account deletion (in its own transaction) can call them.
// A budget limit the user set at runtime names them in `updated_by`: it is exported, and a deletion clears the name
// and keeps the limit, which belongs to the app.
import { ok, type ModuleContext, type Ok, type PrivacyContributor } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { asc, eq } from "drizzle-orm";
import { budgetLimits, charges } from "../schema.js";

/** One charge as it appears in a user's export. */
export interface ExportedCharge {
  readonly provider: string;
  readonly step: string | null;
  readonly unit: string;
  readonly amount: number;
  readonly status: "reserved" | "settled";
  readonly attributes: Readonly<Record<string, string>>;
  readonly createdAt: Date;
}

/** A budget limit the user last changed. */
export interface ExportedBudgetLimit {
  readonly provider: string;
  readonly period: "day" | "month";
  readonly perAccount: boolean;
  readonly limit: number;
  readonly updatedAt: Date;
}

/** What metering holds about one user. */
export interface MeteringUserData {
  readonly charges: readonly ExportedCharge[];
  readonly budgetLimits: readonly ExportedBudgetLimit[];
}

/** What a deletion changed: the charges and the budget limits that named the user. */
export interface MeteringDeletionReport {
  readonly anonymizedCharges: number;
  readonly anonymizedBudgetLimits: number;
}

export type MeteringPrivacyContext = Pick<ModuleContext, "db">;

export async function exportMeteringUserData(context: MeteringPrivacyContext, userId: string): Promise<Ok<MeteringUserData>> {
  // Core types `db` as unknown; privacy passes the @softure-ai/db handle or its transaction.
  const db = context.db as Queryable;
  const rows = await db
    .select({
      provider: charges.provider,
      step: charges.step,
      unit: charges.unit,
      amount: charges.amount,
      status: charges.status,
      attributes: charges.attributes,
      createdAt: charges.createdAt,
    })
    .from(charges)
    .where(eq(charges.accountId, userId))
    .orderBy(asc(charges.createdAt), asc(charges.id));
  const limits = await db
    .select({ provider: budgetLimits.provider, period: budgetLimits.period, perAccount: budgetLimits.perAccount, limit: budgetLimits.limit, updatedAt: budgetLimits.updatedAt })
    .from(budgetLimits)
    .where(eq(budgetLimits.updatedBy, userId))
    .orderBy(asc(budgetLimits.provider), asc(budgetLimits.period), asc(budgetLimits.perAccount));
  return ok({
    charges: rows.map((row) => ({ ...row, amount: Number(row.amount) })),
    budgetLimits: limits.map((row) => ({ ...row, limit: Number(row.limit) })),
  });
}

export async function deleteMeteringUserData(context: MeteringPrivacyContext, userId: string): Promise<Ok<MeteringDeletionReport>> {
  const db = context.db as Queryable;
  const anonymized = await db.update(charges).set({ accountId: null, attributes: {} }).where(eq(charges.accountId, userId)).returning({ id: charges.id });
  const limits = await db.update(budgetLimits).set({ updatedBy: null }).where(eq(budgetLimits.updatedBy, userId)).returning({ provider: budgetLimits.provider });
  return ok({ anonymizedCharges: anonymized.length, anonymizedBudgetLimits: limits.length });
}

export const meteringPrivacyContributor: PrivacyContributor = {
  exportUserData: exportMeteringUserData,
  // Privacy's contract answers a deletion with an empty ok; the count is for apps that call the helper.
  deleteUserData: async (context, userId) => {
    await deleteMeteringUserData(context, userId);
    return ok();
  },
};
