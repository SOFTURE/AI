// The runtime kill switch for writes. `mcp-access.writes_enabled` is read through the switch-reader
// contract of `@softure-ai/core` on every request: when the app defines it in
// `@softure-ai/feature-switches`, turning it off takes writes away at once, without a deploy. An app that
// does not define it keeps `allowWrites` alone.
import { errorLogLabel, readSwitch } from "@softure-ai/core";
import { WRITES_ENABLED_SWITCH } from "../index.js";
import { getMcpAccessOptions } from "./options.js";
import type { McpAccessContext } from "./tokens.js";

/**
 * Whether the app lets anyone write right now: `allowWrites` and the switch (on when the app does not
 * define it). Without `allowWrites` the switch is not read. A read that throws counts as off (writes
 * are the risky side) and is logged by the switch's name.
 */
export async function isWritingEnabled(ctx: McpAccessContext): Promise<boolean> {
  if (!getMcpAccessOptions(ctx.config).allowWrites) return false;
  try {
    const reading = await readSwitch(ctx, WRITES_ENABLED_SWITCH);
    return reading.kind === "undeclared" || reading.isEnabled;
  } catch (error) {
    console.error(`@softure-ai/mcp-access: reading the ${WRITES_ENABLED_SWITCH} switch failed, writes are off: ${errorLogLabel(error)}`);
    return false;
  }
}
