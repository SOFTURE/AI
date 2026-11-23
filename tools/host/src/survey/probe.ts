import { readFileSync } from "node:fs";
import { fail } from "../cli/failure.js";
import type { Runner } from "../cli/process.js";
import type { Inventory } from "../inventory/index.js";
import { buildAdminSsh } from "../ssh/index.js";
import { parseServerFacts, type ServerFacts } from "./facts.js";

/** The probe's source: `src/survey/probe.sh`, reached from `src/survey/` and from `dist/survey/` alike. */
const PROBE_URL = new URL("../../src/survey/probe.sh", import.meta.url);

export function readProbeScript(): string {
  return readFileSync(PROBE_URL, "utf8");
}

/**
 * Runs the read-only probe over the admin's SSH connection (`sh -s` with the script on stdin) and parses what it
 * found. The deploy user and the firewall name are inventory values the schema limits to plain names.
 */
export async function readServerFacts(runner: Runner, inventory: Inventory): Promise<ServerFacts> {
  const { server } = inventory;
  const ssh = buildAdminSsh(inventory, ["sh", "-s", "--", server.deployUser, inventory.firewall.name]);
  const result = await runner.capture(ssh.program, ssh.args, readProbeScript());
  if (result.status !== 0) {
    return fail(`cannot survey ${server.host} as ${server.adminUser}: ${result.stderr.trim() || `exit ${result.status}`}`);
  }
  return parseServerFacts(result.stdout);
}
