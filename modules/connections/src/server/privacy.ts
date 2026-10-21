// The connections part of a GDPR export and deletion (`@softure-ai/privacy`). A connection belongs to the app
// (the owner's account at a provider), not to the admin who clicked connect: it keeps that admin's id in
// `connected_by`. Deleting the admin clears the id and keeps the connection; their pending authorizations go.
// The export lists which connections they made, never a secret. Both helpers read only `db`.
import { ok, type ModuleContext, type Ok, type PrivacyContributor } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { asc, eq } from "drizzle-orm";
import { accounts, oauthStates } from "../schema.js";

/** What connections holds about one user, as it appears in their export. */
export interface ConnectionsUserData {
  readonly connectedAccounts: readonly { readonly provider: string; readonly accountId: string; readonly connectedAt: Date }[];
  readonly pendingAuthorizations: readonly { readonly provider: string; readonly accountId: string; readonly createdAt: Date }[];
}

export interface ConnectionsDeletionReport {
  readonly clearedConnections: number;
  readonly deletedAuthorizations: number;
}

/** The part of the module context the privacy helpers read. */
export type ConnectionsPrivacyContext = Pick<ModuleContext, "db">;

export async function exportConnectionsUserData(context: ConnectionsPrivacyContext, userId: string): Promise<Ok<ConnectionsUserData>> {
  // Core types `db` as unknown; privacy passes the @softure-ai/db handle or its transaction.
  const db = context.db as Queryable;
  const connected = await db
    .select({ provider: accounts.provider, accountId: accounts.accountId, connectedAt: accounts.connectedAt })
    .from(accounts)
    .where(eq(accounts.connectedBy, userId))
    .orderBy(asc(accounts.provider), asc(accounts.accountId));
  const pending = await db
    .select({ provider: oauthStates.provider, accountId: oauthStates.accountId, createdAt: oauthStates.createdAt })
    .from(oauthStates)
    .where(eq(oauthStates.createdBy, userId))
    .orderBy(asc(oauthStates.createdAt));
  return ok({ connectedAccounts: connected, pendingAuthorizations: pending });
}

export async function deleteConnectionsUserData(context: ConnectionsPrivacyContext, userId: string): Promise<Ok<ConnectionsDeletionReport>> {
  const db = context.db as Queryable;
  const cleared = await db.update(accounts).set({ connectedBy: null }).where(eq(accounts.connectedBy, userId)).returning({ id: accounts.id });
  const deleted = await db.delete(oauthStates).where(eq(oauthStates.createdBy, userId)).returning({ stateHash: oauthStates.stateHash });
  return ok({ clearedConnections: cleared.length, deletedAuthorizations: deleted.length });
}

export const connectionsPrivacyContributor: PrivacyContributor = {
  exportUserData: exportConnectionsUserData,
  // Privacy's contract answers a deletion with an empty ok; the counts are for apps that call the helper.
  deleteUserData: async (context, userId) => {
    await deleteConnectionsUserData(context, userId);
    return ok();
  },
};
