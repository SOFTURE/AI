import { describe, expect, it } from "vitest";
import { planInitFiles } from "../init/generate.js";
import { checkSharedHostCompose, type SharedHostComposeOptions } from "./shared-host-compose.js";

const OPTIONS: SharedHostComposeOptions = { edgeNetwork: "proxy", namePrefix: "acme", bypassPaths: ["/mcp", "/oauth"] };

function composeWith(appLabels: readonly string[], extra = ""): string {
  return [
    "services:",
    "  app:",
    "    image: ghcr.io/acme/app:v1",
    "    networks: [edge, default]",
    "    labels:",
    ...appLabels.map((label) => `      - "${label}"`),
    extra,
    "networks:",
    "  edge:",
    "    name: proxy",
    "    external: true",
    "",
  ].join("\n");
}

const APP_LABELS = [
  "traefik.enable=true",
  "traefik.docker.network=proxy",
  "traefik.http.routers.acme.rule=Host(`acme.example`)",
  "traefik.http.routers.acme.middlewares=acme-headers",
  "traefik.http.services.acme.loadbalancer.server.port=3000",
  "traefik.http.middlewares.acme-headers.headers.stsSeconds=31536000",
];

describe("checkSharedHostCompose", () => {
  it("passes the compose file init --edge writes for an app without a database, www included", () => {
    const files = planInitFiles({
      answers: { domain: "acme.example", image: "ghcr.io/acme/app", name: "acme", paths: ["/"], www: true, env: [], tables: [], edge: "proxy" },
      facts: { packageName: "acme", hasDatabase: false, hasHealthRoute: true, hasPublicDir: false, nextConfigFile: "next.config.ts", isStandalone: true },
      cliVersion: "9.9.9",
    });
    const compose = files.find((file) => file.path === "docker/prod/docker-compose.yml")?.text ?? "";
    expect(compose).toContain("traefik.http.routers.acme-www");
    expect(checkSharedHostCompose(compose, OPTIONS)).toEqual([]);
  });

  it("passes a compliant file with map labels and the legacy external form", () => {
    const compose = [
      "services:",
      "  app:",
      "    labels:",
      "      traefik.http.routers.acme.rule: Host(`acme.example`)",
      "      traefik.http.services.acme.loadbalancer.server.port: 3000",
      "networks:",
      "  web:",
      "    external:",
      "      name: proxy",
    ].join("\n");
    expect(checkSharedHostCompose(compose, OPTIONS)).toEqual([]);
  });

  describe("edge network", () => {
    it("reports a file that never joins it", () => {
      expect(checkSharedHostCompose("services:\n  app:\n    image: x\n", OPTIONS)).toEqual([
        { rule: "edge-network-missing", service: null, message: "no top-level network joins proxy as external: true" },
      ]);
    });

    it("reports a network that declares it instead of joining it, by name or by key", () => {
      expect(checkSharedHostCompose("networks:\n  edge:\n    name: proxy\n", OPTIONS)).toEqual([
        { rule: "edge-network-not-external", service: null, message: 'network "edge" declares proxy instead of joining it as external: true' },
      ]);
      expect(checkSharedHostCompose("networks:\n  proxy:\n    driver: bridge\n", OPTIONS).map((violation) => violation.rule)).toEqual([
        "edge-network-not-external",
      ]);
    });

    it("reports settings that would change the external network", () => {
      const compose = "networks:\n  edge:\n    name: proxy\n    external: true\n    driver: overlay\n    internal: true\n";
      expect(checkSharedHostCompose(compose, OPTIONS)).toEqual([
        { rule: "edge-network-changed", service: null, message: 'network "edge" sets driver, internal on the external proxy' },
      ]);
    });

    it("ignores the app's own networks", () => {
      expect(checkSharedHostCompose(composeWith(APP_LABELS).replace("networks:\n  edge:", "networks:\n  default:\n    driver: bridge\n  edge:"), OPTIONS)).toEqual(
        [],
      );
    });
  });

  describe("host ports and network", () => {
    it("reports published ports in the short and long form, a loopback port included", () => {
      const compose = composeWith(APP_LABELS, "  postgres:\n    ports: ['127.0.0.1:5432:5432', {target: 80, published: 8080}]");
      expect(checkSharedHostCompose(compose, OPTIONS)).toEqual([
        { rule: "host-ports", service: "postgres", message: "publishes host ports (127.0.0.1:5432:5432, 8080:80)" },
      ]);
    });

    it("reports network_mode: host and accepts an empty ports list", () => {
      const compose = composeWith(APP_LABELS, "  tool:\n    network_mode: host\n    ports: []");
      expect(checkSharedHostCompose(compose, OPTIONS)).toEqual([{ rule: "host-network", service: "tool", message: "uses network_mode: host" }]);
    });
  });

  describe("Traefik names", () => {
    it("reports each router, middleware and service without the prefix once", () => {
      const compose = composeWith([
        ...APP_LABELS,
        "traefik.http.routers.app.rule=Host(`acme.example`)",
        "traefik.http.routers.app.entrypoints=websecure",
        "traefik.http.middlewares.headers.headers.stsSeconds=1",
        "traefik.http.services.web.loadbalancer.server.port=3000",
        "traefik.tcp.routers.db.rule=HostSNI(`*`)",
      ]);
      expect(checkSharedHostCompose(compose, OPTIONS)).toEqual([
        { rule: "traefik-name-prefix", service: "app", message: 'http router "app" does not carry the prefix acme' },
        { rule: "traefik-name-prefix", service: "app", message: 'http middleware "headers" does not carry the prefix acme' },
        { rule: "traefik-name-prefix", service: "app", message: 'http service "web" does not carry the prefix acme' },
        { rule: "traefik-name-prefix", service: "app", message: 'tcp router "db" does not carry the prefix acme' },
      ]);
    });

    it("takes a prefix at a dash boundary only, with or without its trailing dash", () => {
      const labels = ["traefik.http.routers.acmecorp.rule=Host(`a.example`)", "traefik.http.routers.acme-www.rule=Host(`a.example`)"];
      expect(checkSharedHostCompose(composeWith(labels), OPTIONS).map((violation) => violation.message)).toEqual([
        'http router "acmecorp" does not carry the prefix acme',
      ]);
      expect(checkSharedHostCompose(composeWith(labels), { ...OPTIONS, namePrefix: "acme-" }).map((violation) => violation.message)).toEqual([
        'http router "acmecorp" does not carry the prefix acme-',
      ]);
    });

    it("reads deploy.labels too", () => {
      const compose = composeWith(APP_LABELS, "  worker:\n    deploy:\n      labels:\n        traefik.http.routers.jobs.rule: Host(`a.example`)");
      expect(checkSharedHostCompose(compose, OPTIONS)).toEqual([
        { rule: "traefik-name-prefix", service: "worker", message: 'http router "jobs" does not carry the prefix acme' },
      ]);
    });

    it("reports traefik.docker.network naming another network", () => {
      const labels = APP_LABELS.map((label) => label.replace("docker.network=proxy", "docker.network=acme_default"));
      expect(checkSharedHostCompose(composeWith(labels), OPTIONS)).toEqual([
        { rule: "traefik-network", service: "app", message: "traefik.docker.network is acme_default, not proxy" },
      ]);
    });
  });

  describe("bypass paths", () => {
    it("reports a router that serves a bypass path behind an auth middleware, directly or through a chain", () => {
      const compose = composeWith([
        "traefik.http.routers.acme.rule=Host(`acme.example`)",
        "traefik.http.routers.acme.middlewares=acme-guard@docker",
        "traefik.http.middlewares.acme-guard.chain.middlewares=acme-headers,acme-login",
        "traefik.http.middlewares.acme-headers.headers.stsSeconds=1",
        "traefik.http.middlewares.acme-login.basicAuth.users=admin:hash",
      ]);
      expect(checkSharedHostCompose(compose, OPTIONS)).toEqual([
        { rule: "bypass-path-blocked", service: "app", message: 'router "acme" serves /mcp through the blocking middleware "acme-login"' },
        { rule: "bypass-path-blocked", service: "app", message: 'router "acme" serves /oauth through the blocking middleware "acme-login"' },
      ]);
    });

    it("passes an auth middleware on a router whose path matchers leave the bypass paths out", () => {
      const compose = composeWith([
        "traefik.http.routers.acme-admin.rule=Host(`acme.example`) && PathPrefix(`/admin`)",
        "traefik.http.routers.acme-admin.middlewares=acme-allow",
        "traefik.http.routers.acme.rule=Host(`acme.example`) && !PathPrefix(`/mcp`) && !PathPrefix(`/oauth`)",
        "traefik.http.routers.acme.middlewares=acme-allow",
        "traefik.http.middlewares.acme-allow.ipAllowList.sourceRange=10.0.0.0/8",
      ]);
      expect(checkSharedHostCompose(compose, OPTIONS)).toEqual([]);
    });

    it("reads a narrower path, an exact path and a regular expression under a bypass path as serving it", () => {
      const compose = composeWith([
        "traefik.http.routers.acme-a.rule=Host(`a.example`) && PathPrefix(`/mcp/tools`)",
        "traefik.http.routers.acme-b.rule=Host(`a.example`) && Path(`/oauth/token`)",
        "traefik.http.routers.acme-c.rule=Host(`a.example`) && PathRegexp(`^/mc`)",
        "traefik.http.routers.acme-a.middlewares=acme-auth",
        "traefik.http.routers.acme-b.middlewares=acme-auth",
        "traefik.http.routers.acme-c.middlewares=acme-auth",
        "traefik.http.middlewares.acme-auth.forwardAuth.address=http://auth",
      ]);
      expect(checkSharedHostCompose(compose, OPTIONS).map((violation) => violation.message)).toEqual([
        'router "acme-a" serves /mcp through the blocking middleware "acme-auth"',
        'router "acme-b" serves /oauth through the blocking middleware "acme-auth"',
        'router "acme-c" serves /mcp through the blocking middleware "acme-auth"',
      ]);
    });

    it("reports a router that claims a bypass path without a Host matcher", () => {
      const compose = composeWith(["traefik.http.routers.acme-mcp.rule=PathPrefix(`/mcp`)"]);
      expect(checkSharedHostCompose(compose, OPTIONS)).toEqual([
        { rule: "bypass-path-claimed", service: "app", message: 'router "acme-mcp" claims /mcp without a Host matcher, on every host of the edge proxy' },
      ]);
    });

    it("reads a router without a rule as the provider's Host default and checks nothing without bypass paths", () => {
      const compose = composeWith(["traefik.http.routers.acme.entrypoints=websecure", "traefik.http.routers.acme-mcp.rule=PathPrefix(`/mcp`)"]);
      expect(checkSharedHostCompose(compose, { ...OPTIONS, bypassPaths: ["/oauth"] })).toEqual([]);
      expect(checkSharedHostCompose(compose, { edgeNetwork: "proxy", namePrefix: "acme" })).toEqual([]);
    });
  });

  it("returns one violation for a file that is not YAML or not a mapping", () => {
    expect(checkSharedHostCompose("services: [", OPTIONS).map((violation) => [violation.rule, violation.service])).toEqual([
      ["compose-unreadable", null],
    ]);
    expect(checkSharedHostCompose("- a\n- b\n", OPTIONS)).toEqual([
      { rule: "compose-unreadable", service: null, message: "the compose file is not a mapping" },
    ]);
  });

  it("throws on options that are a bug in the caller", () => {
    expect(() => checkSharedHostCompose("", { ...OPTIONS, edgeNetwork: " " })).toThrow("checkSharedHostCompose: edgeNetwork is empty");
    expect(() => checkSharedHostCompose("", { ...OPTIONS, namePrefix: "" })).toThrow("checkSharedHostCompose: namePrefix is empty");
    expect(() => checkSharedHostCompose("", { ...OPTIONS, bypassPaths: ["mcp"] })).toThrow('bypass path "mcp" does not start with /');
  });
});

describe("checkSharedHostCompose with ingress tunnel (issue #905)", () => {
  const TUNNEL: SharedHostComposeOptions = { edgeNetwork: "proxy", namePrefix: "acme", ingress: "tunnel" };

  it("passes the compose file init --tunnel writes for an app without a database", () => {
    const files = planInitFiles({
      answers: { domain: "acme.example", image: "ghcr.io/acme/app", name: "acme", paths: ["/"], www: false, env: [], tables: [], tunnel: true },
      facts: { packageName: "acme", hasDatabase: false, hasHealthRoute: true, hasPublicDir: false, nextConfigFile: "next.config.ts", isStandalone: true },
      cliVersion: "9.9.9",
    });
    const compose = files.find((file) => file.path === "docker/prod/docker-compose.yml")?.text ?? "";
    expect(checkSharedHostCompose(compose, TUNNEL)).toEqual([]);
  });

  it("reports the edge network, joined or declared, instead of requiring it", () => {
    expect(checkSharedHostCompose(composeWith(["traefik.enable=false"]), TUNNEL)).toEqual([
      { rule: "edge-network-joined", service: null, message: 'network "edge" puts the app on proxy, which a tunnel app never joins' },
    ]);
    expect(checkSharedHostCompose("services:\n  app:\n    image: a\nnetworks:\n  proxy: {}\n", TUNNEL).map((violation) => violation.rule)).toEqual([
      "edge-network-joined",
    ]);
    expect(checkSharedHostCompose("services:\n  app:\n    image: a\nnetworks:\n  tunnel: {}\n", TUNNEL)).toEqual([]);
  });

  it("reports every Traefik label but traefik.enable=false, in list and map form, on each service", () => {
    const compose = [
      "services:",
      "  app:",
      "    image: a",
      "    labels: [traefik.enable=true, traefik.http.routers.acme.rule=Host(`acme.example`)]",
      "  worker:",
      "    image: a",
      "    deploy:",
      "      labels:",
      '        traefik.enable: "False"',
      "        traefik.http.services.acme.loadbalancer.server.port: 3000",
      "  cloudflared:",
      "    image: cloudflare/cloudflared:2026.10.1",
      "    labels: [traefik.enable=false, com.example.team=web]",
      "",
    ].join("\n");
    expect(checkSharedHostCompose(compose, TUNNEL)).toEqual([
      {
        rule: "traefik-routing",
        service: "app",
        message: "carries Traefik routing labels (traefik.enable, traefik.http.routers.acme.rule) next to a tunnel",
      },
      {
        rule: "traefik-routing",
        service: "worker",
        message: "carries Traefik routing labels (traefik.http.services.acme.loadbalancer.server.port) next to a tunnel",
      },
    ]);
  });

  it("keeps the host port and host network rules", () => {
    const compose = 'services:\n  app:\n    image: a\n    ports: ["127.0.0.1:3000:3000"]\n  cloudflared:\n    image: b\n    network_mode: host\n';
    expect(checkSharedHostCompose(compose, TUNNEL).map((violation) => [violation.rule, violation.service])).toEqual([
      ["host-ports", "app"],
      ["host-network", "cloudflared"],
    ]);
  });

  it("checks the edge rules when ingress is edge, as without the option", () => {
    const compose = composeWith(APP_LABELS);
    expect(checkSharedHostCompose(compose, { ...OPTIONS, ingress: "edge" })).toEqual(checkSharedHostCompose(compose, OPTIONS));
  });
});
