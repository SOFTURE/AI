import { APP_ROOT } from "../ansible/vars.js";
import type { Inventory, InventoryApp } from "../inventory/index.js";
import { getFingerprint, type PublicKey } from "../ssh/index.js";

/**
 * An operator key's label: lower-case letters and digits, no dash. The comment `<slug>-operator-<label>` then splits
 * at its last `-operator-` into exactly one app and one label, and never ends in `-release`, the release key line's
 * comment that the collection's deploy_user role matches.
 */
export const OPERATOR_LABEL = /^[a-z0-9]{1,32}$/;
export const DEFAULT_OPERATOR_LABEL = "default";
const RESERVED_LABELS = new Set(["release"]);

export function isOperatorLabel(label: string): boolean {
  return OPERATOR_LABEL.test(label) && !RESERVED_LABELS.has(label);
}

/** The comment that identifies an operator key line: `<slug>-operator-<label>`. */
export function formatOperatorComment(slug: string, label: string): string {
  return `${slug}-operator-${label}`;
}

/** The forced command every key of an app runs: the app's own deploy.sh. */
export function formatForcedCommand(slug: string): string {
  return `${APP_ROOT}/${slug}/deploy.sh`;
}

/** The authorized_keys line of an operator key: the app's forced command, `restrict`, the key, the operator comment. */
export function formatOperatorLine(slug: string, label: string, key: PublicKey): string {
  return `command="${formatForcedCommand(slug)}",restrict ${key.type} ${key.body} ${formatOperatorComment(slug, label)}`;
}

export interface OperatorLine {
  label: string;
  fingerprint: string;
  /** The line carries exactly this app's forced command and `restrict`; false marks a line edited by hand. */
  isRestricted: boolean;
}

/** The operator key lines of one app in an authorized_keys file, matched by their comment, in file order. */
export function listOperatorLines(text: string, slug: string): OperatorLine[] {
  const prefix = `command="${formatForcedCommand(slug)}",restrict `;
  const lines: OperatorLine[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const fields = line.split(/\s+/);
    const comment = fields.at(-1) ?? "";
    const marker = `${slug}-operator-`;
    if (!comment.startsWith(marker)) continue;
    const label = comment.slice(marker.length);
    if (!isOperatorLabel(label)) continue;
    const body = fields.at(-2) ?? "";
    const type = fields.at(-3) ?? "";
    lines.push({
      label,
      fingerprint: getFingerprint(`${type} ${body}`),
      isRestricted: line.startsWith(prefix) && fields.length === 4,
    });
  }
  return lines;
}

/** What `deploy.sh` accepts over the forced command, for this app (`run` and `report` only with a database). */
export function listDeployCommands(app: InventoryApp): string[] {
  return [
    "status",
    "deploy <tag>",
    "maintain [<hook>]",
    "cleanup [--keep=<n>] [--commit]",
    ...(app.database ? ["run <script> [--key=value ...]", "report [--key=value ...] < <file>.sql"] : []),
  ];
}

/** The ssh command line an operator runs with their key: `ssh -i <key> [-p <port>] <deployUser>@<host>`. */
export function formatOperatorSsh(inventory: Inventory, privateKeyPath: string): string {
  const { server } = inventory;
  const port = server.port === 22 ? "" : ` -p ${server.port}`;
  return `ssh -i ${privateKeyPath}${port} ${server.deployUser}@${server.host}`;
}
