// The mcp-access part of a GDPR export and deletion (`@softure-ai/privacy`): the user's access
// tokens and connected apps (OAuth grants), by name and dates. Never a hash. Deletion removes them
// by name before auth deletes the account, so it does not rest on the foreign keys' cascade alone.
import { ok, type ModuleContext, type Ok, type PrivacyContributor } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { accessTokens, oauthAuthorizationCodes, oauthClients, oauthGrants } from "../schema.js";

/** What mcp-access holds about one user, as it appears in their export. */
export interface McpAccessUserData {
  readonly accessTokens: readonly {
    readonly name: string;
    readonly canWrite: boolean;
    readonly createdAt: Date;
    readonly expiresAt: Date;
    readonly lastUsedAt: Date | null;
  }[];
  /** Apps connected through OAuth; their short-lived access tokens are not listed one by one. */
  readonly connectedApps: readonly {
    readonly clientName: string;
    readonly canWrite: boolean;
    readonly createdAt: Date;
    readonly lastUsedAt: Date | null;
  }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function exportMcpAccessUserData(context: ModuleContext, userId: string): Promise<Ok<McpAccessUserData>> {
  if (!UUID.test(userId)) return ok({ accessTokens: [], connectedApps: [] });
  // Core types `db` as unknown; privacy passes the @softure-ai/db handle or its transaction.
  const db = context.db as Queryable;
  const tokens = await db
    .select({
      name: accessTokens.name,
      canWrite: accessTokens.canWrite,
      createdAt: accessTokens.createdAt,
      expiresAt: accessTokens.expiresAt,
      lastUsedAt: accessTokens.lastUsedAt,
    })
    .from(accessTokens)
    .where(and(eq(accessTokens.userId, userId), isNull(accessTokens.grantId)))
    .orderBy(asc(accessTokens.createdAt));
  const connectedApps = await db
    .select({ clientName: oauthClients.clientName, canWrite: oauthGrants.canWrite, createdAt: oauthGrants.createdAt, lastUsedAt: oauthGrants.lastUsedAt })
    .from(oauthGrants)
    .innerJoin(oauthClients, eq(oauthGrants.clientId, oauthClients.id))
    .where(eq(oauthGrants.userId, userId))
    .orderBy(asc(oauthGrants.createdAt));
  return ok({ accessTokens: tokens, connectedApps });
}

export async function deleteMcpAccessUserData(context: ModuleContext, userId: string): Promise<Ok<undefined>> {
  if (!UUID.test(userId)) return ok();
  const db = context.db as Queryable;
  await db.delete(oauthAuthorizationCodes).where(eq(oauthAuthorizationCodes.userId, userId));
  // A grant's access tokens go with it by cascade; the next line takes the hand-issued ones.
  await db.delete(oauthGrants).where(eq(oauthGrants.userId, userId));
  await db.delete(accessTokens).where(eq(accessTokens.userId, userId));
  return ok();
}

export const mcpAccessPrivacyContributor: PrivacyContributor = {
  exportUserData: exportMcpAccessUserData,
  deleteUserData: deleteMcpAccessUserData,
};
