import { fail } from "../cli/failure.js";
import type { Runner } from "../cli/process.js";
import type { Inventory } from "../inventory/index.js";

export interface HostKey {
  type: string;
  key: string;
}

const HOST_KEY_LINE = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(?:256|384|521)) ([A-Za-z0-9+/=]+)(?: .*)?$/;

/** The host key lines of `/etc/ssh/ssh_host_*_key.pub`; anything else in the output is refused. */
export function parseHostKeys(text: string): HostKey[] {
  const keys: HostKey[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const match = HOST_KEY_LINE.exec(trimmed);
    if (match === null) return fail(`unexpected line among the server's host keys: ${trimmed.slice(0, 40)}`);
    keys.push({ type: match[1] ?? "", key: match[2] ?? "" });
  }
  if (keys.length === 0) return fail("the server returned no host keys");
  return keys;
}

/** known_hosts lines for the server: `host` on port 22, `[host]:port` otherwise. */
export function formatKnownHosts(host: string, port: number, keys: readonly HostKey[]): string {
  const name = port === 22 ? host : `[${host}]:${port}`;
  return keys.map((hostKey) => `${name} ${hostKey.type} ${hostKey.key}`).join("\n");
}

/**
 * Reads the server's own host keys over the admin's SSH connection. That connection checks the host against the
 * admin's known_hosts (BatchMode refuses an unknown host instead of asking), so the pinned keys are the ones the
 * admin already trusts, not a blind keyscan.
 */
export async function readHostKeys(runner: Runner, inventory: Inventory): Promise<HostKey[]> {
  const { server } = inventory;
  const result = await runner.capture("ssh", [
    "-o",
    "BatchMode=yes",
    "-p",
    String(server.port),
    ...(server.identityFile === undefined ? [] : ["-i", server.identityFile]),
    `${server.adminUser}@${server.host}`,
    "cat /etc/ssh/ssh_host_*_key.pub",
  ]);
  if (result.status !== 0) {
    return fail(`cannot read the host keys as ${server.adminUser}@${server.host}: ${result.stderr.trim() || `exit ${result.status}`}`);
  }
  return parseHostKeys(result.stdout);
}
