/** Whether the admin can read what needs root: as root, through passwordless sudo, or not at all. */
export type AdminSudo = "root" | "passwordless" | "password" | "absent";

/** Docker as the admin sees it: not installed, installed but unreadable, or readable with its server version. */
export type DockerState = { kind: "absent" } | { kind: "denied" } | { kind: "readable"; version: string };

/** How a user may become root: in `sudo`/`wheel`/`admin`, through a sudoers entry, not at all, or unknown. */
export type SudoRights = "group" | "sudoers" | "no" | "unknown";

export interface ServerUser {
  name: string;
  groups: string[];
  sudo: SudoRights;
}

/** A running Traefik container: the edge other apps join. */
export interface RunningEdge {
  container: string;
  image: string;
  /** Its compose project, empty when it was not started by compose. */
  project: string;
  networks: string[];
  entryPoints: string[];
  /** Resolvers named in its command line (`--certificatesresolvers.<name>.…`). */
  certResolvers: string[];
}

export interface SshdAccess {
  /** `effective`: `sshd -T` as root; `files`: read from the config files, without Match blocks. */
  source: "effective" | "files";
  allowUsers: string[];
  allowGroups: string[];
  denyUsers: string[];
  denyGroups: string[];
}

/** What the probe (probe.sh) found on the server. */
export interface ServerFacts {
  adminSudo: AdminSudo;
  os: string | undefined;
  users: ServerUser[];
  sshd: SshdAccess;
  docker: DockerState;
  networks: string[];
  edges: RunningEdge[];
  /** Resolvers the routers of running containers name (`traefik.http.routers.*.tls.certresolver`). */
  routerResolvers: string[];
  appFolders: string[];
  firewall: { name: string; present: boolean } | undefined;
}

const ADMIN_SUDO = new Set<AdminSudo>(["root", "passwordless", "password", "absent"]);
const SUDO_RIGHTS = new Set<SudoRights>(["group", "sudoers", "no", "unknown"]);

function splitList(text: string | undefined, separator: RegExp): string[] {
  return (text ?? "").split(separator).filter((part) => part !== "");
}

/** Reads `--entrypoints.<name>.…` and `--certificatesresolvers.<name>.…` from Traefik's command line. */
function readTraefikArgs(args: string): { entryPoints: string[]; certResolvers: string[] } {
  const find = (pattern: RegExp) => [...new Set([...args.matchAll(pattern)].map((match) => match[1] ?? ""))];
  return {
    entryPoints: find(/--entrypoints\.([A-Za-z0-9_-]+)\./gi),
    certResolvers: find(/--certificatesresolvers\.([A-Za-z0-9_-]+)\./gi),
  };
}

/** Parses the probe's `<kind>\t<fields…>` lines; a line it does not know is skipped, never guessed at. */
export function parseServerFacts(output: string): ServerFacts {
  const facts: ServerFacts = {
    adminSudo: "absent",
    os: undefined,
    users: [],
    sshd: { source: "files", allowUsers: [], allowGroups: [], denyUsers: [], denyGroups: [] },
    docker: { kind: "absent" },
    networks: [],
    edges: [],
    routerResolvers: [],
    appFolders: [],
    firewall: undefined,
  };
  for (const raw of output.split("\n")) {
    const [kind, ...fields] = raw.replace(/\r$/, "").split("\t");
    const [first = "", second, third, fourth, fifth] = fields;
    switch (kind) {
      case "sudo":
        if (ADMIN_SUDO.has(first as AdminSudo)) facts.adminSudo = first as AdminSudo;
        break;
      case "os":
        facts.os = first;
        break;
      case "user":
        facts.users.push({
          name: first,
          groups: splitList(second, /,/),
          sudo: SUDO_RIGHTS.has(third as SudoRights) ? (third as SudoRights) : "unknown",
        });
        break;
      case "sshd-source":
        facts.sshd.source = first === "effective" ? "effective" : "files";
        break;
      case "sshd": {
        const values = splitList(second, /\s+/);
        if (first === "allowusers") facts.sshd.allowUsers.push(...values);
        if (first === "allowgroups") facts.sshd.allowGroups.push(...values);
        if (first === "denyusers") facts.sshd.denyUsers.push(...values);
        if (first === "denygroups") facts.sshd.denyGroups.push(...values);
        break;
      }
      case "docker":
        facts.docker = first === "absent" || first === "denied" ? { kind: first } : { kind: "readable", version: first || "unknown" };
        break;
      case "network":
        facts.networks.push(first);
        break;
      case "edge":
        facts.edges.push({
          container: first,
          image: second ?? "",
          project: third ?? "",
          networks: splitList(fourth, /,/),
          ...readTraefikArgs(fifth ?? ""),
        });
        break;
      case "router-resolver":
        facts.routerResolvers.push(first);
        break;
      case "app-folder":
        facts.appFolders.push(first);
        break;
      case "firewall":
        facts.firewall = { name: first, present: second === "present" };
        break;
      default:
        break;
    }
  }
  return facts;
}
