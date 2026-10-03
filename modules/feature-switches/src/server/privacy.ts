// The feature-switches part of a GDPR export and deletion (`@softure-ai/privacy`). A switch keeps
// the id of whoever set it last (`updated_by`); deleting that user clears the id and keeps the
// switch's state and date, since the switch belongs to the app, not to the user.
import { ok, type ModuleContext, type Ok, type PrivacyContributor } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { asc, eq } from "drizzle-orm";
import { switches } from "../schema.js";

/** What feature-switches holds about one user, as it appears in their export. */
export interface SwitchesUserData {
  /** The switches this user set last. */
  readonly lastSetSwitches: readonly { readonly name: string; readonly isEnabled: boolean; readonly updatedAt: Date }[];
}

export async function exportSwitchesUserData(context: ModuleContext, userId: string): Promise<Ok<SwitchesUserData>> {
  // Core types `db` as unknown; privacy passes the @softure-ai/db handle or its transaction.
  const db = context.db as Queryable;
  const rows = await db
    .select({ name: switches.name, isEnabled: switches.enabled, updatedAt: switches.updatedAt })
    .from(switches)
    .where(eq(switches.updatedBy, userId))
    .orderBy(asc(switches.name));
  return ok({ lastSetSwitches: rows });
}

export async function deleteSwitchesUserData(context: ModuleContext, userId: string): Promise<Ok<undefined>> {
  const db = context.db as Queryable;
  await db.update(switches).set({ updatedBy: null }).where(eq(switches.updatedBy, userId));
  return ok();
}

export const switchesPrivacyContributor: PrivacyContributor = {
  exportUserData: exportSwitchesUserData,
  deleteUserData: deleteSwitchesUserData,
};
