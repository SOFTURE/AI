// The feature-switches part of a GDPR export and deletion (`@softure-ai/privacy`). A switch keeps
// the id of whoever set it last (`updated_by`); deleting that user clears the id and keeps the
// switch's state and date, since the switch belongs to the app, not to the user. Both helpers read only
// `db`, so an app that runs its own account deletion (in its own transaction) can call them with `{ db }`.
import { ok, type ModuleContext, type Ok, type PrivacyContributor } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { asc, eq } from "drizzle-orm";
import { switches } from "../schema.js";

/** What feature-switches holds about one user, as it appears in their export. */
export interface SwitchesUserData {
  /** The switches this user set last. */
  readonly lastSetSwitches: readonly { readonly name: string; readonly isEnabled: boolean; readonly updatedAt: Date }[];
}

/** What a deletion changed: the switches whose `updated_by` named the user. */
export interface SwitchesDeletionReport {
  readonly clearedSwitches: number;
}

/** The part of the module context the privacy helpers read. */
export type SwitchesPrivacyContext = Pick<ModuleContext, "db">;

export async function exportSwitchesUserData(context: SwitchesPrivacyContext, userId: string): Promise<Ok<SwitchesUserData>> {
  // Core types `db` as unknown; privacy passes the @softure-ai/db handle or its transaction.
  const db = context.db as Queryable;
  const rows = await db
    .select({ name: switches.name, isEnabled: switches.enabled, updatedAt: switches.updatedAt })
    .from(switches)
    .where(eq(switches.updatedBy, userId))
    .orderBy(asc(switches.name));
  return ok({ lastSetSwitches: rows });
}

export async function deleteSwitchesUserData(context: SwitchesPrivacyContext, userId: string): Promise<Ok<SwitchesDeletionReport>> {
  const db = context.db as Queryable;
  const cleared = await db.update(switches).set({ updatedBy: null }).where(eq(switches.updatedBy, userId)).returning();
  return ok({ clearedSwitches: cleared.length });
}

export const switchesPrivacyContributor: PrivacyContributor = {
  exportUserData: exportSwitchesUserData,
  // Privacy's contract answers a deletion with an empty ok; the count is for apps that call the helper.
  deleteUserData: async (context, userId) => {
    await deleteSwitchesUserData(context, userId);
    return ok();
  },
};
