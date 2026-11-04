// Sessions tied to the tool list version (#1055), checked on the app's factories: a release that changes a tool must
// renew the sessions opened before it, or a connected client keeps the old schemas. Framework-free: it throws.
import type { McpServerIdentity } from "../contract.js";
import type { McpServerFactory, VersionedMcpServerFactory } from "../server/endpoint.js";
import { createToolListSessionId, isToolListSessionCurrent } from "../server/tool-list-session.js";
import { fingerprintToolList, listServedTools } from "../server/tool-list.js";

const READER: McpServerIdentity = { userId: "00000000-0000-4000-8000-000000000001", canWrite: false, tokenId: "session-check" };
const WRITER: McpServerIdentity = { ...READER, canWrite: true };
const LEVELS = [
  ["read", READER],
  ["write", WRITER],
] as const;

/**
 * Throws unless a session opened under `before` (the previous release's factory) is renewed under `after` for every
 * access level whose served tool list changed, and kept for every level whose list did not. A pair where no level
 * changed throws too: the check would prove nothing.
 */
export async function expectToolListSessionRenewed(before: McpServerFactory, after: McpServerFactory): Promise<void> {
  const problems: string[] = [];
  const unchanged: string[] = [];
  for (const [level, identity] of LEVELS) {
    const sessionId = createToolListSessionId(await readVersion(before, identity));
    const isCurrent = isToolListSessionCurrent(sessionId, await readVersion(after, identity));
    const hasChanged = fingerprintToolList(await listServedTools(() => before(identity))) !== fingerprintToolList(await listServedTools(() => after(identity)));
    if (!hasChanged) unchanged.push(level);
    if (hasChanged && isCurrent) problems.push(`the ${level} tool list changed but a session opened before is kept`);
    if (!hasChanged && !isCurrent) problems.push(`the ${level} tool list did not change but a session opened before is renewed`);
  }
  if (unchanged.length === LEVELS.length) problems.push(`the tool list did not change for any access level (${unchanged.join(", ")})`);
  if (problems.length > 0) throw new Error(`@softure-ai/mcp-access: sessions do not follow the tool list: ${problems.join("; ")}`);
}

async function readVersion(factory: McpServerFactory, identity: McpServerIdentity): Promise<string> {
  const reader = (factory as Partial<VersionedMcpServerFactory>).toolListVersion;
  if (typeof reader !== "function") {
    throw new Error("@softure-ai/mcp-access: the factory has no toolListVersion; build it with createMcpServerFactory or pass toolListVersion to createMcpEndpoint");
  }
  return reader(identity);
}
