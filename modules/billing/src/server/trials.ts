// Trials an admin extends by hand (the admin page's "Extend a trial" form): the trial end moves
// later and the change is recorded in `billing.trial_extensions` with the end before and after, so
// the account's history lists it beside the manual grants. Unlike a granted plan it never writes
// `paid_until`, so an app that counts paying accounts by it does not count a free extension. Locks
// follow every change's order (account, then the entitlement row, then the new row).
import { users } from "@softure-ai/auth";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { eq } from "drizzle-orm";
import type { Entitlement, TrialExtensionErrorCode } from "../contract.js";
import { applyEntitlementEvent, resolveEntitlement } from "../entitlement.js";
import { entitlements, trialExtensions } from "../schema.js";
import { findEntitlementRecord, pinEntitlementRow, type BillingContext } from "./entitlements.js";
import { getEntitlementPolicy } from "./options.js";
import { lockEntitlementRow } from "./take-back.js";
import { isUserId } from "./user-id.js";

export interface ExtendTrialManuallyInput {
  readonly userId: string;
  /** The trial's new end: the first instant it no longer covers. */
  readonly until: Date;
  /** The admin who extends it; null for an extension without one (a script). */
  readonly adminId: string | null;
}

export interface TrialExtensionResult {
  readonly extensionId: string;
  /** Where the account stands after the extension (paid access still wins over the trial). */
  readonly entitlement: Entitlement;
}

/**
 * Moves the account's trial end to `until` and records it, in one transaction. Refuses an end at
 * or before now (`billing.end_not_in_future`) and one at or before the current trial end
 * (`billing.trial_not_extended`); every refusal writes nothing. Database errors propagate.
 */
export async function extendTrialManually(ctx: BillingContext, input: ExtendTrialManuallyInput): Promise<Ok<TrialExtensionResult> | Err<TrialExtensionErrorCode>> {
  if (!isUserId(input.userId)) return err("billing.account_unknown");
  return ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    // A shared lock: the account cannot be deleted before the extension below.
    const [account] = await tx.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, input.userId)).for("key share");
    if (account === undefined) return err("billing.account_unknown");
    // The derived trial pinned and locked before the check, so a concurrent change is seen here.
    const isPinned = await pinEntitlementRow({ ...ctx, db: tx }, { userId: input.userId, accountCreatedAt: account.createdAt });
    await lockEntitlementRow(tx, input.userId);
    const record = await findEntitlementRecord({ ...ctx, db: tx }, input.userId);
    // The account was locked above and its row pinned.
    if (record === null) throw new Error("@softure-ai/billing: an account vanished while its trial was being extended");

    const refusal = input.until <= now ? "billing.end_not_in_future" : input.until <= record.trialEndsAt ? "billing.trial_not_extended" : null;
    if (refusal !== null) {
      // The pin is this transaction's own row, nobody else has seen it: undo it, so the refusal writes nothing.
      if (isPinned) await tx.delete(entitlements).where(eq(entitlements.userId, input.userId));
      return err(refusal);
    }
    const next = applyEntitlementEvent(record, { type: "extend_trial", until: input.until }, now);
    // Both of the event's refusals were checked above.
    if (!next.ok) throw new Error(`@softure-ai/billing: extending a trial failed with ${next.error}`);
    await tx
      .update(entitlements)
      .set({ trialEndsAt: next.value.trialEndsAt, updatedAt: now })
      .where(eq(entitlements.userId, input.userId));
    const [row] = await tx
      .insert(trialExtensions)
      .values({ userId: input.userId, extendedBy: input.adminId, extendedAt: now, previousEndsAt: record.trialEndsAt, endsAt: next.value.trialEndsAt })
      .returning();
    if (row === undefined) throw new Error("@softure-ai/billing: recording a trial extension returned no row");
    return ok({ extensionId: row.id, entitlement: resolveEntitlement(next.value, now, getEntitlementPolicy(ctx.config)) });
  });
}
