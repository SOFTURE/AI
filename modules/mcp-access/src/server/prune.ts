// The module's scheduled cleanup: expired access tokens and dead OAuth records of every account, in
// one call for a daily job (`softure-mcp prune`, a deploy `maintain` hook) instead of inline on requests.
import { pruneOAuthRecords, type PrunedOAuthRecords } from "./oauth.js";
import { pruneAccessTokens, type McpAccessContext } from "./tokens.js";

export interface PrunedMcpAccessRecords extends PrunedOAuthRecords {
  readonly accessTokens: number;
}

/** Runs `pruneAccessTokens`, then `pruneOAuthRecords`, and counts what each removed. */
export async function pruneMcpAccess(ctx: McpAccessContext): Promise<PrunedMcpAccessRecords> {
  const accessTokens = await pruneAccessTokens(ctx);
  return { accessTokens, ...(await pruneOAuthRecords(ctx)) };
}
