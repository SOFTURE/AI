// The mcp-access part of a GDPR export and deletion (`@softure-ai/privacy`): the user's access
// tokens, by name and dates. Never a token hash. Deletion removes the tokens by name before auth
// deletes the account, so it does not rest on the foreign key's cascade alone.
import { ok, type ModuleContext, type Ok, type PrivacyContributor } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { asc, eq } from "drizzle-orm";
import { accessTokens } from "../schema.js";

/** What mcp-access holds about one user, as it appears in their export. */
export interface McpAccessUserData {
  readonly accessTokens: readonly {
    readonly name: string;
    readonly canWrite: boolean;
    readonly createdAt: Date;
    readonly expiresAt: Date;
    readonly lastUsedAt: Date | null;
  }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function exportMcpAccessUserData(context: ModuleContext, userId: string): Promise<Ok<McpAccessUserData>> {
  if (!UUID.test(userId)) return ok({ accessTokens: [] });
  // Core types `db` as unknown; privacy passes the @softure-ai/db handle or its transaction.
  const db = context.db as Queryable;
  const rows = await db
    .select({
      name: accessTokens.name,
      canWrite: accessTokens.canWrite,
      createdAt: accessTokens.createdAt,
      expiresAt: accessTokens.expiresAt,
      lastUsedAt: accessTokens.lastUsedAt,
    })
    .from(accessTokens)
    .where(eq(accessTokens.userId, userId))
    .orderBy(asc(accessTokens.createdAt));
  return ok({ accessTokens: rows });
}

export async function deleteMcpAccessUserData(context: ModuleContext, userId: string): Promise<Ok<undefined>> {
  if (!UUID.test(userId)) return ok();
  await (context.db as Queryable).delete(accessTokens).where(eq(accessTokens.userId, userId));
  return ok();
}

export const mcpAccessPrivacyContributor: PrivacyContributor = {
  exportUserData: exportMcpAccessUserData,
  deleteUserData: deleteMcpAccessUserData,
};
