import { readFile } from "node:fs/promises";
import { buildServerVars } from "../ansible/index.js";
import { loadInventory } from "../inventory/index.js";
import { runPlaybook } from "./ansible-step.js";
import { resolvePath, say, type HostDeps } from "./context.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";
import { readFlags, requireFlag } from "./options.js";

const PUBLIC_KEY_LINE = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(?:256|384|521)|sk-ssh-ed25519@openssh\.com) [A-Za-z0-9+/=]+( [^\n]*)?$/;

async function readAdminPublicKey(io: CliIo, path: string | undefined): Promise<string> {
  if (path === undefined) {
    return fail("server: the inventory needs server.adminPublicKey (the .pub file the admin logs in with)", USAGE_EXIT_CODE);
  }
  const fullPath = resolvePath(io, path);
  const text = await readFile(fullPath, "utf8").catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    return fail(`server: cannot read server.adminPublicKey ${fullPath}: ${reason}`);
  });
  const line = text.trim();
  if (!PUBLIC_KEY_LINE.test(line)) return fail(`server: ${fullPath} is not one SSH public key line`, USAGE_EXIT_CODE);
  return line;
}

/**
 * `softure-host server`: the collection's bootstrap plus the shared edge, idempotent. `--connect-as` logs in as a
 * provider's first user (root, ubuntu) on a fresh server; later runs use the admin user.
 */
export async function runServer(args: string[], io: CliIo, deps: HostDeps): Promise<void> {
  const flags = readFlags("server", args, {
    inventory: { type: "string" },
    check: { type: "boolean", default: false },
    "connect-as": { type: "string" },
  });
  const inventory = await loadInventory(resolvePath(io, requireFlag("server", "inventory", flags.inventory)));
  const adminPublicKey = await readAdminPublicKey(io, inventory.server.adminPublicKey);
  const connectAs = flags["connect-as"] ?? inventory.server.adminUser;
  const { server, edge, firewall } = inventory;
  say(io, "server", `${flags.check ? "checking" : "converging"} ${server.host} as ${connectAs} (admin ${server.adminUser}, deploy user ${server.deployUser})`);
  say(io, "server", edge.manage ? `edge ${edge.name} on network ${edge.network}, resolver ${edge.certResolver}` : `edge left as it is (network ${edge.network})`);
  say(io, "server", firewall.manage ? `origin firewall ${firewall.name}, ranges ${firewall.rangesFile}` : "origin firewall left as it is");
  await runPlaybook(deps, { playbook: "server.yml", vars: buildServerVars(inventory, { adminPublicKey, connectAs }), check: flags.check });
  say(io, "server", flags.check ? "check done; nothing was changed" : `done. Log in as ${server.adminUser} from now on; next: softure-host app add --app=<slug>`);
}
