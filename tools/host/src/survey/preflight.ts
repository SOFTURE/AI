import { parse } from "yaml";
import type { Inventory } from "../inventory/index.js";
import type { ServerFacts } from "./facts.js";
import { isInventoryEdge } from "./report.js";

export interface OnboardingCheck {
  /** What stops `app add` before any change. */
  problems: string[];
  /** What was checked, or why a check was skipped. */
  notes: string[];
}

/** An external network of the compose file: as written, and its name once the variables are resolved. */
export interface ComposeNetwork {
  written: string;
  /** Undefined when a variable without a default is not set. */
  resolved: string | undefined;
}

const VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:?-)([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;

/** Compose's interpolation for `${NAME}`, `${NAME:-default}`, `${NAME-default}` and `$NAME`. */
export function resolveComposeValue(value: string, env: Readonly<Record<string, string>>): string | undefined {
  let unresolved = false;
  const result = value.replace(VARIABLE, (_match, name: string | undefined, operator: string | undefined, fallback: string | undefined, bare: string | undefined) => {
    const variable = name ?? bare ?? "";
    const set = env[variable];
    if (operator === ":-" && (set === undefined || set === "")) return fallback ?? "";
    if (operator === "-" && set === undefined) return fallback ?? "";
    if (set === undefined) unresolved = true;
    return set ?? "";
  });
  return unresolved ? undefined : result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The top-level external networks of a compose file, resolved with `env`. `app add` sets `EDGE_NETWORK` to the
 * inventory's `edge.network` (#1429), so `${EDGE_NETWORK:-…}` resolves to it whatever the default says.
 */
export function findExternalNetworks(compose: string, env: Readonly<Record<string, string>>): ComposeNetwork[] {
  const document: unknown = parse(compose);
  if (!isRecord(document) || !isRecord(document.networks)) return [];
  const found: ComposeNetwork[] = [];
  for (const [key, entry] of Object.entries(document.networks)) {
    if (!isRecord(entry)) continue;
    const external = entry.external;
    if (external !== true && !isRecord(external)) continue;
    const named = isRecord(external) && typeof external.name === "string" ? external.name : entry.name;
    const written = typeof named === "string" ? named : key;
    found.push({ written, resolved: resolveComposeValue(written, env) });
  }
  return found;
}

export interface OnboardingInput {
  facts: ServerFacts;
  inventory: Inventory;
  /** The app's `docker/prod/docker-compose.yml`, or null when it has none. */
  compose: string | null;
  composePath: string;
}

/**
 * What `app add` checks on a server before it changes anything: an edge the inventory would duplicate, an edge
 * network that does not exist, and a compose file that joins another network. sshd's AllowUsers is the playbook's
 * part (ansible/tasks/deploy-user-sshd.yml), since reading it fully and fixing it both need root.
 */
export function checkOnboarding(input: OnboardingInput): OnboardingCheck {
  const { facts, inventory } = input;
  const { server, edge } = inventory;
  const problems: string[] = [];
  const notes: string[] = [];

  if (facts.docker.kind !== "readable") {
    const why = facts.docker.kind === "absent" ? "is not installed" : `cannot be read by ${server.adminUser}`;
    notes.push(`Docker on ${server.host} ${why}: the edge checks are skipped`);
  } else {
    const foreign = facts.edges.filter((running) => !isInventoryEdge(running, inventory));
    if (edge.manage && foreign.length > 0) {
      const names = foreign.map((running) => `${running.container} (compose project ${running.project || "none"}, networks ${running.networks.join(", ") || "none"})`);
      problems.push(
        `an edge already runs on ${server.host}: ${names.join("; ")}, while the inventory has edge.manage: true. ` +
          "Set edge.manage: false with that edge's edge.network and edge.certResolver (softure-host survey prints the block), " +
          "and never run softure-host server on this server.",
      );
    }
    if (facts.networks.includes(edge.network)) {
      notes.push(`the edge network ${edge.network} exists`);
    } else {
      const fix = edge.manage
        ? "run softure-host server first, which creates it"
        : "set edge.network to the network the running edge joins (softure-host survey prints it)";
      problems.push(`the inventory's edge.network ${edge.network} does not exist on ${server.host} (Docker networks there: ${facts.networks.join(", ") || "none"}); ${fix}.`);
    }
  }

  if (input.compose === null) {
    notes.push(`the app has no ${input.composePath}: the network check is skipped`);
  } else {
    const networks = findExternalNetworks(input.compose, { EDGE_NETWORK: edge.network });
    if (networks.length === 0) {
      notes.push(`${input.composePath} joins no external network`);
    } else if (networks.some((network) => network.resolved === edge.network)) {
      notes.push(`${input.composePath} joins ${edge.network}`);
    } else {
      const named = networks.map((network) =>
        network.resolved === undefined ? `${network.written} (a variable that is not set)` : network.resolved === network.written ? network.resolved : `${network.resolved} (written ${network.written})`,
      );
      problems.push(
        `${input.composePath} joins the external network ${named.join(", ")}, but the inventory's edge.network is ${edge.network}. ` +
          `Write \${EDGE_NETWORK:-${edge.network}} in the app's compose file (softure-deploy init --edge does), or fix edge.network.`,
      );
    }
  }
  return { problems, notes };
}
