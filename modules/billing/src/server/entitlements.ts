// Reading and changing an account's entitlement. An account without a row is on the trial that
// starts at its `auth.users.created_at`, derived on every read, so reads never write. A change pins
// that derived record into a row first, then applies the event under the row's lock.
import { users } from "@softure-ai/auth";
import { err, ok, type Err, type ModuleContext, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { eq } from "drizzle-orm";
import { getTrialEnd } from "../calendar.js";
import type { BillingErrorCode, Entitlement, EntitlementEvent, EntitlementRecord } from "../contract.js";
import { applyEntitlementEvent, resolveEntitlement } from "../entitlement.js";
import { entitlements } from "../schema.js";
import { getBillingOptions, getEntitlementPolicy } from "./options.js";
import { isUserId } from "./user-id.js";

export type BillingContext = ModuleContext<Queryable>;

/** The trial an account without a row is on: `trial.days` from the day it was created. */
export function getDefaultRecord(ctx: Pick<BillingContext, "config">, accountCreatedAt: Date): EntitlementRecord {
  const trialEndsAt = getTrialEnd(accountCreatedAt, getBillingOptions(ctx.config).trial.days, ctx.config.timezone);
  return { trialEndsAt, paidUntil: null, isLifetime: false };
}

/** The account's stored or derived record, or null when no account has this id. */
export async function findEntitlementRecord(ctx: Pick<BillingContext, "db" | "config">, userId: string): Promise<EntitlementRecord | null> {
  if (!isUserId(userId)) return null;
  const [row] = await ctx.db
    .select({
      accountCreatedAt: users.createdAt,
      trialEndsAt: entitlements.trialEndsAt,
      paidUntil: entitlements.paidUntil,
      isLifetime: entitlements.isLifetime,
    })
    .from(users)
    .leftJoin(entitlements, eq(entitlements.userId, users.id))
    .where(eq(users.id, userId));
  if (row === undefined) return null;
  if (row.trialEndsAt === null) return getDefaultRecord(ctx, row.accountCreatedAt);
  return { trialEndsAt: row.trialEndsAt, paidUntil: row.paidUntil, isLifetime: row.isLifetime ?? false };
}

/** Where the account stands now, or null when no account has this id. Database errors propagate. */
export async function getEntitlement(ctx: BillingContext, userId: string): Promise<Entitlement | null> {
  const record = await findEntitlementRecord(ctx, userId);
  return record === null ? null : resolveEntitlement(record, ctx.clock.now(), getEntitlementPolicy(ctx.config));
}

/**
 * The write guard without a framework: `Ok` with the entitlement when the account may write,
 * `billing.read_only` when it may only read, `billing.account_unknown` without an account.
 */
export async function checkWriteAccess(ctx: BillingContext, userId: string): Promise<Ok<Entitlement> | Err<"billing.read_only" | "billing.account_unknown">> {
  const entitlement = await getEntitlement(ctx, userId);
  if (entitlement === null) return err("billing.account_unknown");
  return entitlement.status === "read_only" ? err("billing.read_only") : ok(entitlement);
}

/** The stored record of an account, locked until the transaction ends, or undefined. */
async function lockStoredRecord(tx: Queryable, userId: string): Promise<EntitlementRecord | undefined> {
  const [row] = await tx
    .select({ trialEndsAt: entitlements.trialEndsAt, paidUntil: entitlements.paidUntil, isLifetime: entitlements.isLifetime })
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .for("update");
  return row;
}

/**
 * Applies `event` to the account's entitlement in one transaction and returns where it stands
 * after; a refused event writes nothing. An account without a row gets one holding its derived
 * trial with the event applied, so the trial end never moves when a row appears. A concurrent
 * change that inserted first is waited for and applied on. Database errors propagate.
 */
export async function changeEntitlement(ctx: BillingContext, userId: string, event: EntitlementEvent): Promise<Ok<Entitlement> | Err<BillingErrorCode>> {
  if (!isUserId(userId)) return err("billing.account_unknown");
  return ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    const policy = getEntitlementPolicy(ctx.config);
    // A shared lock: the account cannot be deleted under the change, other changes still read it.
    const [account] = await tx.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).for("key share");
    if (account === undefined) return err("billing.account_unknown");

    const stored = await lockStoredRecord(tx, userId);
    if (stored === undefined) {
      const next = applyEntitlementEvent(getDefaultRecord(ctx, account.createdAt), event, now);
      if (!next.ok) return next;
      const inserted = await tx
        .insert(entitlements)
        .values({ userId, ...next.value, createdAt: now, updatedAt: now })
        .onConflictDoNothing({ target: entitlements.userId })
        .returning();
      if (inserted.length > 0) return ok(resolveEntitlement(next.value, now, policy));
    }

    // The row existed, or a concurrent change inserted it after the read above (the insert waited
    // for that transaction, so the row is visible now).
    const current = stored ?? (await lockStoredRecord(tx, userId));
    if (current === undefined) throw new Error("@softure-ai/billing: an entitlement row vanished while it was being changed");
    const next = applyEntitlementEvent(current, event, now);
    if (!next.ok) return next;
    await tx
      .update(entitlements)
      .set({ ...next.value, updatedAt: now })
      .where(eq(entitlements.userId, userId));
    return ok(resolveEntitlement(next.value, now, policy));
  });
}
