import { readFile } from "node:fs/promises";
import { buildOperatorVars } from "../ansible/index.js";
import { findApp, loadInventory, type Inventory, type InventoryApp } from "../inventory/index.js";
import {
  DEFAULT_OPERATOR_LABEL,
  formatOperatorComment,
  formatOperatorLine,
  formatOperatorSsh,
  isOperatorLabel,
  listDeployCommands,
  listOperatorLines,
} from "../operator/index.js";
import { captureAsAdmin, getFingerprint, parsePublicKey, type PublicKey } from "../ssh/index.js";
import { runPlaybook } from "./ansible-step.js";
import { resolvePath, say, type HostDeps } from "./context.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";
import { readFlags, requireFlag } from "./options.js";

interface Target {
  inventory: Inventory;
  app: InventoryApp;
}

async function loadTarget(command: string, io: CliIo, flags: { inventory?: string; app?: string }): Promise<Target> {
  const inventory = await loadInventory(resolvePath(io, requireFlag(command, "inventory", flags.inventory)));
  return { inventory, app: findApp(inventory, requireFlag(command, "app", flags.app)) };
}

function readLabel(command: string, name: string | undefined): string {
  const label = name ?? DEFAULT_OPERATOR_LABEL;
  if (!isOperatorLabel(label)) {
    return fail(`${command}: --name must be 1 to 32 lower-case letters or digits, not "release": ${label}`, USAGE_EXIT_CODE);
  }
  return label;
}

async function readOperatorKey(io: CliIo, path: string): Promise<PublicKey> {
  const fullPath = resolvePath(io, path);
  const text = await readFile(fullPath, "utf8").catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    return fail(`operator add-key: cannot read --key ${fullPath}: ${reason}`);
  });
  const parsed = parsePublicKey(text);
  if (!parsed.ok) return fail(`operator add-key: ${fullPath} is not one SSH public key: ${parsed.reason}`, USAGE_EXIT_CODE);
  return parsed.key;
}

/** The private key next to a `.pub` file, as the operator passes it to `ssh -i`. */
function findPrivateKeyPath(publicKeyPath: string): string {
  return publicKeyPath.endsWith(".pub") ? publicKeyPath.slice(0, -".pub".length) : "<private key>";
}

function printUsage(io: CliIo, target: Target, privateKeyPath: string): void {
  const ssh = formatOperatorSsh(target.inventory, privateKeyPath);
  say(io, "operator", `run deploy.sh's commands with: ${ssh} <command>`);
  for (const command of listDeployCommands(target.app)) say(io, "operator", `  ${command}`);
  say(io, "operator", `an interactive shell is refused; for example: ${ssh} status`);
}

/**
 * `softure-host operator add-key`: binds the operator's own key to the app's deploy.sh in the deploy user's
 * authorized_keys, by its label: added or replaced in place, never duplicated, other lines untouched.
 */
export async function runOperatorAddKey(args: string[], io: CliIo, deps: HostDeps): Promise<void> {
  const flags = readFlags("operator add-key", args, {
    inventory: { type: "string" },
    app: { type: "string" },
    key: { type: "string" },
    name: { type: "string" },
    check: { type: "boolean", default: false },
  });
  const target = await loadTarget("operator add-key", io, flags);
  const label = readLabel("operator add-key", flags.name);
  const keyPath = requireFlag("operator add-key", "key", flags.key);
  const key = await readOperatorKey(io, keyPath);
  const { app, inventory } = target;
  const comment = formatOperatorComment(app.slug, label);
  say(io, "operator", `${flags.check ? "would add" : "adding"} ${comment} (${getFingerprint(`${key.type} ${key.body}`)}) for ${inventory.server.deployUser}@${inventory.server.host}`);
  say(io, "operator", `line: ${formatOperatorLine(app.slug, label, key)}`);
  await runPlaybook(deps, { playbook: "operator.yml", vars: buildOperatorVars(inventory, app, label, { state: "present", key }), check: flags.check });
  if (flags.check) {
    say(io, "operator", "check done; nothing was changed");
    return;
  }
  say(io, "operator", `${comment} is in ${inventory.server.deployUser}'s authorized_keys`);
  printUsage(io, target, findPrivateKeyPath(keyPath));
}

/** `softure-host operator remove-key`: removes the app's operator key line with this label, and nothing else. */
export async function runOperatorRemoveKey(args: string[], io: CliIo, deps: HostDeps): Promise<void> {
  const flags = readFlags("operator remove-key", args, {
    inventory: { type: "string" },
    app: { type: "string" },
    name: { type: "string" },
    check: { type: "boolean", default: false },
  });
  const { inventory, app } = await loadTarget("operator remove-key", io, flags);
  const label = readLabel("operator remove-key", flags.name);
  const comment = formatOperatorComment(app.slug, label);
  say(io, "operator", `${flags.check ? "would remove" : "removing"} ${comment} from ${inventory.server.deployUser}@${inventory.server.host}`);
  await runPlaybook(deps, { playbook: "operator.yml", vars: buildOperatorVars(inventory, app, label, { state: "absent" }), check: flags.check });
  say(io, "operator", flags.check ? "check done; nothing was changed" : `${comment} is not in ${inventory.server.deployUser}'s authorized_keys`);
}

/** `softure-host operator list`: the app's operator key lines, read over the admin's connection; changes nothing. */
export async function runOperatorList(args: string[], io: CliIo, deps: HostDeps): Promise<void> {
  const flags = readFlags("operator list", args, { inventory: { type: "string" }, app: { type: "string" } });
  const { inventory, app } = await loadTarget("operator list", io, flags);
  const { server } = inventory;
  const result = await captureAsAdmin(deps.runner, inventory, `sudo -n cat ~${server.deployUser}/.ssh/authorized_keys`);
  if (result.status !== 0) {
    return fail(`operator list: cannot read ${server.deployUser}'s authorized_keys as ${server.adminUser}@${server.host}: ${result.stderr.trim() || `exit ${result.status}`}`);
  }
  const lines = listOperatorLines(result.stdout, app.slug);
  if (lines.length === 0) say(io, "operator", `${app.slug} has no operator keys; add one with operator add-key`);
  for (const line of lines) {
    const warning = line.isRestricted ? "" : " (NOT bound to deploy.sh with restrict: re-add it with operator add-key)";
    say(io, "operator", `${formatOperatorComment(app.slug, line.label)} ${line.fingerprint}${warning}`);
  }
}
