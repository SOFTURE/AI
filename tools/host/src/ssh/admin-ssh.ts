import type { Inventory } from "../inventory/index.js";

/**
 * `ssh` as the admin user, running `remote` on the server. BatchMode checks the host against the admin's
 * known_hosts and refuses an unknown one instead of asking, and never prompts for a password.
 */
export function buildAdminSsh(inventory: Inventory, remote: readonly string[]): { program: string; args: string[] } {
  const { server } = inventory;
  return {
    program: "ssh",
    args: [
      "-o",
      "BatchMode=yes",
      "-p",
      String(server.port),
      ...(server.identityFile === undefined ? [] : ["-i", server.identityFile]),
      `${server.adminUser}@${server.host}`,
      ...remote,
    ],
  };
}
