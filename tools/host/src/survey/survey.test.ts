import { describe, expect, it } from "vitest";
import { parseInventory } from "../inventory/index.js";
import { parseServerFacts } from "./facts.js";
import { checkOnboarding, findExternalNetworks, resolveComposeValue } from "./preflight.js";
import { readProbeScript } from "./probe.js";
import { formatSurvey, suggestEdgeBlock } from "./report.js";

const inventory = parseInventory(
  { server: { host: "srv.example.com", adminUser: "admin" }, edge: { manage: false, network: "web", certResolver: "le" } },
  "test",
);

const PROBE_OUTPUT = [
  "sudo\tpasswordless",
  "os\tUbuntu 24.04.1 LTS",
  "user\tadmin\tadmin,sudo,docker\tgroup",
  "user\tops\tops\tsudoers",
  "sshd-source\teffective",
  "sshd\tallowusers\tadmin ops@10.0.0.*",
  "sshd\tallowgroups\t",
  "docker\t27.3.1",
  "network\tbridge",
  "network\tweb",
  "edge\tproxy-traefik-1\ttraefik:v3.3\tproxy\tbridge,web,\t--entrypoints.web.address=:80 --entrypoints.websecure.address=:443 --certificatesresolvers.le.acme.email=a@b.c --certificatesresolvers.le.acme.storage=/x",
  "router-resolver\tle",
  "app-folder\t/srv/first-app",
  "firewall\tsofture-cloudflare-only\tabsent",
  "something new\tignored",
].join("\n");

describe("the survey probe", () => {
  it("is a POSIX sh script that only reads", () => {
    const script = readProbeScript();
    expect(script.startsWith("#!/bin/sh\n")).toBe(true);
    // Nothing that writes: no redirection into a file, no package manager, no service control.
    expect(script).not.toMatch(/>\s*\/(etc|srv|home)|apt-get|systemctl (start|stop|restart|reload)|docker (rm|run|network create)/);
  });

  it("parses every kind of line and skips lines it does not know", () => {
    const facts = parseServerFacts(PROBE_OUTPUT);
    expect(facts).toMatchObject({
      adminSudo: "passwordless",
      os: "Ubuntu 24.04.1 LTS",
      users: [
        { name: "admin", groups: ["admin", "sudo", "docker"], sudo: "group" },
        { name: "ops", groups: ["ops"], sudo: "sudoers" },
      ],
      sshd: { source: "effective", allowUsers: ["admin", "ops@10.0.0.*"], allowGroups: [] },
      docker: { kind: "readable", version: "27.3.1" },
      networks: ["bridge", "web"],
      edges: [{ container: "proxy-traefik-1", project: "proxy", networks: ["bridge", "web"], entryPoints: ["web", "websecure"], certResolvers: ["le"] }],
      routerResolvers: ["le"],
      appFolders: ["/srv/first-app"],
      firewall: { name: "softure-cloudflare-only", present: false },
    });
    expect(parseServerFacts("docker\tdenied\n").docker).toEqual({ kind: "denied" });
    expect(parseServerFacts("").docker).toEqual({ kind: "absent" });
  });
});

describe("the survey report", () => {
  it("prints each section and the edge block of an edge that already runs", () => {
    const text = formatSurvey(parseServerFacts(PROBE_OUTPUT), inventory);
    expect(text).toContain("system: admin has passwordless sudo\n");
    expect(text).toContain("users: ops: sudo (sudoers); groups ops\n");
    expect(text).toContain("users: deploy (deploy user) does not exist yet; app add creates it\n");
    expect(text).toContain("sshd: AllowUsers admin, ops@10.0.0.*; AllowGroups none (effective, sshd -T)\n");
    expect(text).toContain("apps: folders under /srv: /srv/first-app\n");
    expect(text).toContain("firewall: softure-cloudflare-only (Cloudflare-only origin) is not installed\n");
    expect(text).toContain("never run `softure-host server` here):\nedge:\n  manage: false\n  network: web\n  certResolver: le\n");
  });

  it("suggests no block for the inventory's own edge, and says what it could not find", () => {
    const own = parseInventory({ server: { host: "h", adminUser: "admin" }, edge: { acmeEmail: "a@b.co" } }, "test");
    const facts = parseServerFacts("docker\t27\nedge\tsofture-edge-traefik-1\ttraefik\tsofture-edge\tsofture-edge,\t\n");
    expect(suggestEdgeBlock(facts, own)).toBeUndefined();
    expect(formatSurvey(facts, own)).toContain("The running edge is this inventory's own (softure-edge).");
    const bare = parseServerFacts("docker\t27\nedge\tedge\ttraefik\t\tbridge,\t--configFile=/etc/traefik.yml\n");
    expect(suggestEdgeBlock(bare, own)).toEqual([
      "edge:",
      "  manage: false",
      "  # network: (the edge joins no network of its own; read its compose file)",
      "  # certResolver: (none found in its command line or in the routers' labels; read its static config)",
    ]);
  });
});

describe("the onboarding preflight", () => {
  it("resolves compose interpolation like compose does", () => {
    expect(resolveComposeValue("${EDGE_NETWORK:-proxy}", { EDGE_NETWORK: "web" })).toBe("web");
    expect(resolveComposeValue("${OTHER:-proxy}", {})).toBe("proxy");
    expect(resolveComposeValue("${OTHER-proxy}", {})).toBe("proxy");
    expect(resolveComposeValue("$EDGE_NETWORK", { EDGE_NETWORK: "web" })).toBe("web");
    expect(resolveComposeValue("${OTHER}", {})).toBeUndefined();
    expect(resolveComposeValue("plain", {})).toBe("plain");
  });

  it("finds the external networks of a compose file, named or by key", () => {
    const compose = [
      "networks:",
      "  edge: { external: true, name: '${EDGE_NETWORK:-proxy}' }",
      "  legacy: { external: { name: old } }",
      "  shared: { external: true }",
      "  default: {}",
    ].join("\n");
    expect(findExternalNetworks(compose, { EDGE_NETWORK: "web" })).toEqual([
      { written: "${EDGE_NETWORK:-proxy}", resolved: "web" },
      { written: "old", resolved: "old" },
      { written: "shared", resolved: "shared" },
    ]);
    expect(findExternalNetworks("services: {}\n", {})).toEqual([]);
  });

  it("skips the edge checks when Docker cannot be read, and names a network variable that is not set", () => {
    const check = checkOnboarding({
      facts: parseServerFacts("docker\tdenied\n"),
      inventory,
      compose: "networks:\n  edge: { external: true, name: '${PROXY_NETWORK}' }\n",
      composePath: "docker/prod/docker-compose.yml",
    });
    expect(check.notes).toEqual(["Docker on srv.example.com cannot be read by admin: the edge checks are skipped"]);
    expect(check.problems).toEqual([
      "docker/prod/docker-compose.yml joins the external network ${PROXY_NETWORK} (a variable that is not set), but the inventory's edge.network is web. Write ${EDGE_NETWORK:-web} in the app's compose file (softure-deploy init --edge does), or fix edge.network.",
    ]);
  });

  it("passes a server whose edge network exists and an app that joins it", () => {
    const check = checkOnboarding({
      facts: parseServerFacts(PROBE_OUTPUT),
      inventory,
      compose: "networks:\n  edge: { external: true, name: web }\n",
      composePath: "c.yml",
    });
    expect(check).toEqual({ problems: [], notes: ["the edge network web exists", "c.yml joins web"] });
  });
});
