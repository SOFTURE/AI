// The signed-in account's entitlement and the write guard, for server components, actions and route
// handlers. React's `cache` makes the lookup once per request; nothing is cached across requests,
// so a grant shows on the next one.
import type { AuthUser } from "@softure-ai/auth";
import { getCurrentUser, requireUser, type RequireUserOptions } from "@softure-ai/auth/next";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { cache } from "react";
import type { Entitlement } from "../contract.js";
import { getEntitlement } from "../server/entitlements.js";
import { getBillingContext } from "./context.js";

/** The entitlement of the request's account, or null without a session. Database failures propagate. */
export const getCurrentEntitlement = cache(async (): Promise<Entitlement | null> => {
  const user = await getCurrentUser();
  if (user === null) return null;
  return getEntitlement(await getBillingContext(), user.id);
});

/** What a write may go ahead with. */
export interface WriteAccess {
  readonly user: AuthUser;
  readonly entitlement: Entitlement;
}

/**
 * The guard for an app's write actions; call it before reading any input. Without a session it
 * redirects to the login page (as `requireUser`); a read-only account gets `billing.read_only` for
 * the action to return to its form. Never a reason to skip the action's own authorization.
 */
export async function requireWriteAccess(options: RequireUserOptions = {}): Promise<Ok<WriteAccess> | Err<"billing.read_only">> {
  const user = await requireUser(options);
  const entitlement = await getCurrentEntitlement();
  // The session's account exists, so it has an entitlement; null would mean it vanished mid-request.
  if (entitlement === null || entitlement.status === "read_only") return err("billing.read_only");
  return ok({ user, entitlement });
}
