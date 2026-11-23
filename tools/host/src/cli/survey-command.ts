import { loadInventory } from "../inventory/index.js";
import { formatSurvey, readServerFacts } from "../survey/index.js";
import { resolvePath, type HostDeps } from "./context.js";
import type { CliIo } from "./io.js";
import { readFlags, requireFlag } from "./options.js";

/**
 * `softure-host survey`: reads, over the admin's SSH connection, what an inventory for the server needs (users and
 * sudo, sshd access, Docker networks, a running edge's names, app folders, the origin firewall) and changes nothing.
 * The inventory gives the connection; its apps may still be empty.
 */
export async function runSurvey(args: string[], io: CliIo, deps: HostDeps): Promise<void> {
  const flags = readFlags("survey", args, { inventory: { type: "string" } });
  const inventory = await loadInventory(resolvePath(io, requireFlag("survey", "inventory", flags.inventory)));
  const facts = await readServerFacts(deps.runner, inventory);
  io.stdout(formatSurvey(facts, inventory));
}
