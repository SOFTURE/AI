// The billing part of a GDPR export and deletion (`@softure-ai/privacy`): the account's entitlement
// row. An account without a row has nothing stored here (its trial is derived from the account).
import { ok, type ModuleContext, type Ok, type PrivacyContributor } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { eq } from "drizzle-orm";
import { entitlements } from "../schema.js";
import { isUserId } from "./user-id.js";

/** What billing holds about one user, as it appears in their export. */
export interface BillingUserData {
  readonly entitlement: {
    readonly trialEndsAt: Date;
    readonly paidUntil: Date | null;
    readonly isLifetime: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  } | null;
}

export async function exportBillingUserData(context: ModuleContext, userId: string): Promise<Ok<BillingUserData>> {
  if (!isUserId(userId)) return ok({ entitlement: null });
  // Core types `db` as unknown; privacy passes the @softure-ai/db handle or its transaction.
  const db = context.db as Queryable;
  const [row] = await db
    .select({
      trialEndsAt: entitlements.trialEndsAt,
      paidUntil: entitlements.paidUntil,
      isLifetime: entitlements.isLifetime,
      createdAt: entitlements.createdAt,
      updatedAt: entitlements.updatedAt,
    })
    .from(entitlements)
    .where(eq(entitlements.userId, userId));
  return ok({ entitlement: row ?? null });
}

export async function deleteBillingUserData(context: ModuleContext, userId: string): Promise<Ok<undefined>> {
  if (!isUserId(userId)) return ok();
  const db = context.db as Queryable;
  await db.delete(entitlements).where(eq(entitlements.userId, userId));
  return ok();
}

export const billingPrivacyContributor: PrivacyContributor = {
  exportUserData: exportBillingUserData,
  deleteUserData: deleteBillingUserData,
};
