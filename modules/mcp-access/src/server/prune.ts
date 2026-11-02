// The module's scheduled cleanup: expired access tokens, dead OAuth records of every account, used
// confirmation tokens and MCP tasks past their expiry, in one call for a daily job (`softure-mcp prune`, a deploy `maintain` hook) instead of inline on requests.
import { lte } from "drizzle-orm";
import { operationTasks } from "../schema.js";
import { pruneUsedConfirmations } from "./confirmation.js";
import { pruneOAuthRecords, type PrunedOAuthRecords } from "./oauth.js";
import { pruneAccessTokens, type McpAccessContext } from "./tokens.js";

export interface PrunedMcpAccessRecords extends PrunedOAuthRecords {
  readonly accessTokens: number;
  readonly usedConfirmations: number;
  readonly operationTasks: number;
}

/** Runs `pruneAccessTokens`, `pruneOAuthRecords`, `pruneUsedConfirmations`, then `pruneOperationTasks`, and counts what each removed. */
export async function pruneMcpAccess(ctx: McpAccessContext): Promise<PrunedMcpAccessRecords> {
  const accessTokens = await pruneAccessTokens(ctx);
  const oauth = await pruneOAuthRecords(ctx);
  const usedConfirmations = await pruneUsedConfirmations(ctx);
  return { accessTokens, ...oauth, usedConfirmations, operationTasks: await pruneOperationTasks(ctx) };
}

/** Deletes the MCP tasks past their expiry (#977); the operations' jobs stay with `@softure-ai/jobs`. */
export async function pruneOperationTasks(ctx: McpAccessContext): Promise<number> {
  const removed = await ctx.db.delete(operationTasks).where(lte(operationTasks.expiresAt, ctx.clock.now())).returning({ taskId: operationTasks.taskId });
  return removed.length;
}
