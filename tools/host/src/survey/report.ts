import type { Inventory } from "../inventory/index.js";
import type { RunningEdge, ServerFacts } from "./facts.js";

/** Networks every Docker host has; an edge's own network is never one of them. */
const BUILT_IN_NETWORKS = new Set(["bridge", "host", "none"]);

/** An edge this inventory manages: its compose project (or its container name) is `edge.name`. */
export function isInventoryEdge(edge: RunningEdge, inventory: Inventory): boolean {
  return edge.project === inventory.edge.name || edge.container.startsWith(inventory.edge.name);
}

function pickPreferred(candidates: readonly string[], preferred: string): string | undefined {
  return candidates.includes(preferred) ? preferred : candidates[0];
}

/**
 * The `edge:` block an inventory needs to join an edge that already runs: never managed, with the edge's own
 * network and resolver. Undefined when no edge runs, or when the only one is the inventory's own.
 */
export function suggestEdgeBlock(facts: ServerFacts, inventory: Inventory): string[] | undefined {
  const edge = facts.edges.find((candidate) => !isInventoryEdge(candidate, inventory));
  if (edge === undefined) return undefined;
  const networks = edge.networks.filter((name) => !BUILT_IN_NETWORKS.has(name));
  const network = pickPreferred(networks, inventory.edge.network);
  const resolvers = edge.certResolvers.length > 0 ? edge.certResolvers : facts.routerResolvers;
  const resolver = pickPreferred(resolvers, inventory.edge.certResolver);
  const others = (all: readonly string[], chosen: string | undefined) => all.filter((name) => name !== chosen);
  const comment = (all: readonly string[], chosen: string | undefined) =>
    others(all, chosen).length > 0 ? `   # also: ${others(all, chosen).join(", ")}` : "";
  return [
    "edge:",
    "  manage: false",
    network === undefined ? "  # network: (the edge joins no network of its own; read its compose file)" : `  network: ${network}${comment(networks, network)}`,
    resolver === undefined
      ? "  # certResolver: (none found in its command line or in the routers' labels; read its static config)"
      : `  certResolver: ${resolver}${comment(resolvers, resolver)}`,
  ];
}

function describeList(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

function describeAdminSudo(facts: ServerFacts, inventory: Inventory): string {
  const admin = inventory.server.adminUser;
  switch (facts.adminSudo) {
    case "root":
      return `${admin} is root`;
    case "passwordless":
      return `${admin} has passwordless sudo`;
    case "password":
      return `${admin} needs a password for sudo: Ansible cannot type it, and root-only reads below are partial`;
    case "absent":
      return `sudo is not installed: root-only reads below are partial`;
  }
}

function describeDocker(facts: ServerFacts): string {
  switch (facts.docker.kind) {
    case "absent":
      return "not installed";
    case "denied":
      return "installed, not readable by the admin (no docker group, no passwordless sudo)";
    case "readable":
      return facts.docker.version;
  }
}

/** The survey: what an inventory for this server needs, read without changing anything. */
export function formatSurvey(facts: ServerFacts, inventory: Inventory): string {
  const { server } = inventory;
  const lines: string[] = [];
  const say = (step: string, text: string) => lines.push(`${step}: ${text}`);
  say("survey", `${server.host} as ${server.adminUser} (read-only; nothing was changed)`);
  say("system", facts.os ?? "unknown OS");
  say("system", describeAdminSudo(facts, inventory));
  say("docker", describeDocker(facts));

  for (const user of facts.users) {
    const sudo = { group: "sudo (group)", sudoers: "sudo (sudoers)", no: "no sudo", unknown: "sudo unknown" }[user.sudo];
    const role = user.name === server.adminUser ? " (admin)" : user.name === server.deployUser ? " (deploy user)" : "";
    say("users", `${user.name}${role}: ${sudo}; groups ${describeList(user.groups)}`);
  }
  if (!facts.users.some((user) => user.name === server.deployUser)) {
    say("users", `${server.deployUser} (deploy user) does not exist yet; app add creates it`);
  }

  const { sshd } = facts;
  const source = sshd.source === "effective" ? "effective, sshd -T" : "config files only (no root): Match blocks not applied";
  say("sshd", `AllowUsers ${describeList(sshd.allowUsers)}; AllowGroups ${describeList(sshd.allowGroups)} (${source})`);
  if (sshd.denyUsers.length > 0 || sshd.denyGroups.length > 0) {
    say("sshd", `DenyUsers ${describeList(sshd.denyUsers)}; DenyGroups ${describeList(sshd.denyGroups)}`);
  }

  if (facts.docker.kind === "readable") {
    say("docker", `networks ${describeList(facts.networks)}`);
    if (facts.edges.length === 0) say("edge", "no Traefik container runs");
    for (const edge of facts.edges) {
      say(
        "edge",
        `${edge.container} (${edge.image}), compose project ${edge.project || "none"}, networks ${describeList(edge.networks)}, ` +
          `entry points ${describeList(edge.entryPoints)}, resolvers ${describeList(edge.certResolvers)}`,
      );
    }
    if (facts.routerResolvers.length > 0) say("edge", `resolvers the running routers name: ${facts.routerResolvers.join(", ")}`);
  }
  say("apps", `folders under /srv: ${describeList(facts.appFolders)}`);
  if (facts.firewall !== undefined) {
    say("firewall", `${facts.firewall.name} (Cloudflare-only origin) ${facts.firewall.present ? "is installed" : "is not installed"}`);
  }

  const block = suggestEdgeBlock(facts, inventory);
  if (block !== undefined) {
    lines.push("", "An edge already runs on this server. For the inventory (and never run `softure-host server` here):", ...block);
  } else if (facts.docker.kind === "readable" && facts.edges.length > 0) {
    lines.push("", `The running edge is this inventory's own (${inventory.edge.name}).`);
  }
  return `${lines.join("\n")}\n`;
}
