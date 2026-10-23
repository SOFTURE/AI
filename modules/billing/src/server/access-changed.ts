// The app's hook on access changes (`billing({ onAccessChanged })`), called by the functions that record a change
// once their transaction committed. The hook is the app's code: whatever it throws is logged and swallowed, so a
// failing analytics call never fails a grant that is already done.
import { errorLogLabel } from "@softure-ai/core";
import type { AccessChange, Entitlement } from "../contract.js";
import type { BillingContext } from "./entitlements.js";
import { getBillingOptions } from "./options.js";

export interface AccessChangeInput {
  readonly accountId: string;
  readonly change: AccessChange;
  readonly planId: string | null;
  readonly entitlement: Entitlement;
  /** The new trial end of a trial extension; paid access' end is read from the entitlement otherwise. */
  readonly trialEndsAt?: Date;
}

/** Paid access' end after a grant or a refund: null for lifetime access, or when no paid access is left. */
function getPaidEnd(entitlement: Entitlement): Date | null {
  return entitlement.status === "paid" ? entitlement.endsAt : null;
}

/**
 * Calls the app's `onAccessChanged`, if any, with the committed change. Call it after the transaction resolved,
 * never inside it. A throw or a rejection is logged by the change's kind and the error's label (never its message,
 * which may carry the app's data) and swallowed.
 */
export async function notifyAccessChanged(ctx: BillingContext, input: AccessChangeInput): Promise<void> {
  const hook = getBillingOptions(ctx.config).onAccessChanged;
  if (hook === undefined) return;
  const { accountId, change, planId, entitlement } = input;
  const endsAt = change === "trial_extended" ? (input.trialEndsAt ?? null) : getPaidEnd(entitlement);
  try {
    await hook({ accountId, change, planId, endsAt, entitlement }, ctx);
  } catch (error) {
    console.error(`@softure-ai/billing: onAccessChanged failed for a "${change}" change: ${errorLogLabel(error)}`);
  }
}
