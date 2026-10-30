// A guard over the production compose file of an app that shares a host's edge proxy with another app (issue #600):
// the edge network is joined, never declared or changed; no service takes a host port or the host network; every
// Traefik name carries the app's prefix, because names are global on a shared Traefik; and no router blocks or
// claims the paths an access-proxy bypass must keep open. An app published by a Cloudflare Tunnel instead (issue #905)
// is held to the opposite: it never joins the edge network and carries no Traefik routing. Pure: the compose text in,
// the violations out.
import { parse } from "yaml";

export type ComposeRule =
  | "compose-unreadable"
  | "edge-network-missing"
  | "edge-network-not-external"
  | "edge-network-changed"
  | "edge-network-joined"
  | "traefik-routing"
  | "host-ports"
  | "host-network"
  | "traefik-name-prefix"
  | "traefik-network"
  | "bypass-path-blocked"
  | "bypass-path-claimed";

/** One breach of the guard. */
export interface ComposeViolation {
  readonly rule: ComposeRule;
  /** The compose service it was found on, or `null` for a top-level breach (networks, an unreadable file). */
  readonly service: string | null;
  readonly message: string;
}

export interface SharedHostComposeOptions {
  /** The edge proxy's network, as `docker network ls` names it (`proxy`). */
  readonly edgeNetwork: string;
  /** What every Traefik router, middleware and service name equals or starts with (`<prefix>-`). */
  readonly namePrefix: string;
  /** Paths the access proxy lets through without a sign-in (`/mcp`, `/oauth`), each starting with `/`. */
  readonly bypassPaths?: readonly string[];
  /**
   * How requests reach the app: `edge` (the default) through the shared Traefik, `tunnel` through a Cloudflare Tunnel
   * of the app's own, so the edge network and Traefik routing are breaches instead of requirements.
   */
  readonly ingress?: "edge" | "tunnel";
}

/** Middleware types that answer a request themselves instead of passing it to the app. */
const BLOCKING_MIDDLEWARES = new Set(["basicauth", "digestauth", "forwardauth", "ipallowlist", "ipwhitelist"]);

const TRAEFIK_NAME = /^traefik\.(http|tcp|udp)\.(routers|middlewares|services)\.([^.]+)\.(.+)$/;

const EDGE_NETWORK_KEYS = new Set(["external", "name"]);

/** Checks a compose file against the shared-host rules; an empty list means it passes. */
export function checkSharedHostCompose(composeYaml: string, options: SharedHostComposeOptions): ComposeViolation[] {
  assertOptions(options);
  let document: unknown;
  try {
    document = parse(composeYaml);
  } catch (error) {
    return [topLevel("compose-unreadable", `the compose file is not YAML: ${(error as Error).message}`)];
  }
  if (!isRecord(document)) return [topLevel("compose-unreadable", "the compose file is not a mapping")];
  const services = isRecord(document.services) ? document.services : {};
  if (options.ingress === "tunnel") {
    return [
      ...checkNoEdgeNetwork(document.networks, options.edgeNetwork),
      ...Object.entries(services).flatMap(([name, service]) => checkTunnelService(name, isRecord(service) ? service : {})),
    ];
  }
  return [
    ...checkEdgeNetwork(document.networks, options.edgeNetwork),
    ...Object.entries(services).flatMap(([name, service]) => checkService(name, isRecord(service) ? service : {}, options)),
  ];
}

function assertOptions(options: SharedHostComposeOptions): void {
  if (options.edgeNetwork.trim() === "") throw new Error("checkSharedHostCompose: edgeNetwork is empty");
  if (options.namePrefix.trim() === "") throw new Error("checkSharedHostCompose: namePrefix is empty");
  for (const path of options.bypassPaths ?? []) {
    if (!path.startsWith("/")) throw new Error(`checkSharedHostCompose: bypass path "${path}" does not start with /`);
  }
}

/** The name Docker gives a top-level network: the legacy `external: { name }`, else `name`, else its key. */
function readNetworkName(key: string, network: Record<string, unknown>): string {
  const external = network.external;
  const legacyName = isRecord(external) && typeof external.name === "string" ? external.name : undefined;
  return legacyName ?? (typeof network.name === "string" ? network.name : key);
}

function checkEdgeNetwork(networks: unknown, edgeNetwork: string): ComposeViolation[] {
  const declared = isRecord(networks) ? Object.entries(networks) : [];
  const violations: ComposeViolation[] = [];
  let isJoined = false;
  for (const [key, value] of declared) {
    const network = isRecord(value) ? value : {};
    const external = network.external;
    if (readNetworkName(key, network) !== edgeNetwork) continue;
    if (external !== true && !isRecord(external)) {
      violations.push(topLevel("edge-network-not-external", `network "${key}" declares ${edgeNetwork} instead of joining it as external: true`));
      continue;
    }
    isJoined = true;
    const extra = Object.keys(network).filter((field) => !EDGE_NETWORK_KEYS.has(field));
    if (extra.length > 0) {
      violations.push(topLevel("edge-network-changed", `network "${key}" sets ${extra.join(", ")} on the external ${edgeNetwork}`));
    }
  }
  if (!isJoined && violations.length === 0) {
    violations.push(topLevel("edge-network-missing", `no top-level network joins ${edgeNetwork} as external: true`));
  }
  return violations;
}

/** A tunnel app declares no network named like the edge one, joined or not: either way it is on the shared proxy's path. */
function checkNoEdgeNetwork(networks: unknown, edgeNetwork: string): ComposeViolation[] {
  const declared = isRecord(networks) ? Object.entries(networks) : [];
  return declared
    .filter(([key, value]) => readNetworkName(key, isRecord(value) ? value : {}) === edgeNetwork)
    .map(([key]) => topLevel("edge-network-joined", `network "${key}" puts the app on ${edgeNetwork}, which a tunnel app never joins`));
}

/** Host ports and the host network stay breaches; any Traefik label but `traefik.enable=false` is routing. */
function checkTunnelService(service: string, definition: Record<string, unknown>): ComposeViolation[] {
  const violations = checkHostAccess(service, definition);
  const routing = [...readLabels(definition)]
    .filter(([key, value]) => key.startsWith("traefik.") && !(key === "traefik.enable" && value.toLowerCase() === "false"))
    .map(([key]) => key);
  if (routing.length > 0) {
    violations.push({ rule: "traefik-routing", service, message: `carries Traefik routing labels (${routing.join(", ")}) next to a tunnel` });
  }
  return violations;
}

function checkHostAccess(service: string, definition: Record<string, unknown>): ComposeViolation[] {
  const violations: ComposeViolation[] = [];
  if (Array.isArray(definition.ports) && definition.ports.length > 0) {
    violations.push({ rule: "host-ports", service, message: `publishes host ports (${definition.ports.map(formatPort).join(", ")})` });
  }
  if (definition.network_mode === "host") violations.push({ rule: "host-network", service, message: "uses network_mode: host" });
  return violations;
}

function checkService(service: string, definition: Record<string, unknown>, options: SharedHostComposeOptions): ComposeViolation[] {
  const violations = checkHostAccess(service, definition);
  const at = (rule: ComposeRule, message: string): void => {
    violations.push({ rule, service, message });
  };

  const labels = readLabels(definition);
  const dockerNetwork = labels.get("traefik.docker.network");
  if (dockerNetwork !== undefined && dockerNetwork !== options.edgeNetwork) {
    at("traefik-network", `traefik.docker.network is ${dockerNetwork}, not ${options.edgeNetwork}`);
  }
  for (const name of readTraefikNames(labels)) {
    if (!hasPrefix(name.name, options.namePrefix)) {
      at("traefik-name-prefix", `${name.kind} "${name.name}" does not carry the prefix ${options.namePrefix}`);
    }
  }
  for (const finding of checkBypassPaths(labels, options.bypassPaths ?? [])) at(finding.rule, finding.message);
  return violations;
}

interface TraefikName {
  readonly kind: string;
  readonly name: string;
}

function readTraefikNames(labels: ReadonlyMap<string, string>): TraefikName[] {
  const seen = new Set<string>();
  const names: TraefikName[] = [];
  for (const key of labels.keys()) {
    const match = TRAEFIK_NAME.exec(key);
    if (!match) continue;
    const [, protocol, group, name] = match as unknown as [string, string, string, string];
    const kind = `${protocol} ${group.slice(0, -1)}`;
    if (seen.has(`${kind}/${name}`)) continue;
    seen.add(`${kind}/${name}`);
    names.push({ kind, name });
  }
  return names;
}

function hasPrefix(name: string, prefix: string): boolean {
  if (name === prefix || name === prefix.replace(/-$/, "")) return true;
  return name.startsWith(prefix.endsWith("-") ? prefix : `${prefix}-`);
}

interface BypassFinding {
  readonly rule: "bypass-path-blocked" | "bypass-path-claimed";
  readonly message: string;
}

function checkBypassPaths(labels: ReadonlyMap<string, string>, bypassPaths: readonly string[]): BypassFinding[] {
  if (bypassPaths.length === 0) return [];
  const findings: BypassFinding[] = [];
  const middlewareTypes = readMiddlewareTypes(labels);
  for (const router of readHttpRouters(labels)) {
    const matchers = readMatchers(router.rule);
    const blocking = router.middlewares.flatMap((middleware) => findBlocking(middleware, middlewareTypes, new Set()));
    for (const path of bypassPaths) {
      if (!servesPath(matchers, path)) continue;
      for (const middleware of blocking) {
        findings.push({
          rule: "bypass-path-blocked",
          message: `router "${router.name}" serves ${path} through the blocking middleware "${middleware}"`,
        });
      }
      if (!matchers.some((matcher) => matcher.kind === "host")) {
        findings.push({
          rule: "bypass-path-claimed",
          message: `router "${router.name}" claims ${path} without a Host matcher, on every host of the edge proxy`,
        });
      }
    }
  }
  return findings;
}

interface HttpRouter {
  readonly name: string;
  /** `null` when the label is absent: the provider's default rule is `Host(<container>)`. */
  readonly rule: string | null;
  readonly middlewares: readonly string[];
}

function readHttpRouters(labels: ReadonlyMap<string, string>): HttpRouter[] {
  const routers = new Map<string, { rule: string | null; middlewares: string[] }>();
  for (const [key, value] of labels) {
    const match = /^traefik\.http\.routers\.([^.]+)\.(.+)$/.exec(key);
    if (!match) continue;
    const [, name, field] = match as unknown as [string, string, string];
    const router = routers.get(name) ?? { rule: null, middlewares: [] };
    if (field === "rule") router.rule = value;
    if (field === "middlewares") router.middlewares = splitList(value);
    routers.set(name, router);
  }
  return [...routers].map(([name, router]) => ({ name, ...router }));
}

/** Each middleware defined in the labels with its type and, for a chain, the middlewares it runs. */
function readMiddlewareTypes(labels: ReadonlyMap<string, string>): Map<string, { type: string; chain: string[] }> {
  const types = new Map<string, { type: string; chain: string[] }>();
  for (const [key, value] of labels) {
    const match = /^traefik\.http\.middlewares\.([^.]+)\.([^.]+)(?:\.(.+))?$/.exec(key);
    if (!match) continue;
    const [, name, type, field] = match as unknown as [string, string, string, string | undefined];
    const middleware = types.get(name) ?? { type: type.toLowerCase(), chain: [] };
    if (middleware.type === "chain" && field === "middlewares") middleware.chain = splitList(value);
    types.set(name, middleware);
  }
  return types;
}

function findBlocking(reference: string, types: ReadonlyMap<string, { type: string; chain: string[] }>, visited: Set<string>): string[] {
  const name = reference.replace(/@.*$/, "");
  const middleware = types.get(name);
  if (!middleware || visited.has(name)) return [];
  visited.add(name);
  if (BLOCKING_MIDDLEWARES.has(middleware.type)) return [name];
  return middleware.chain.flatMap((inner) => findBlocking(inner, types, visited));
}

/** A path matcher reads each bypass path as the prefix of every request under it, as the access proxy does. */
type Matcher =
  | { readonly kind: "host" }
  | {
      readonly kind: "path";
      readonly isNegated: boolean;
      /** Whether some request under the bypass path matches. */
      readonly overlaps: (bypassPath: string) => boolean;
      /** Whether every request under the bypass path matches. */
      readonly covers: (bypassPath: string) => boolean;
    };

const MATCHER = /(!\s*)?\b(Host|HostRegexp|HostSNI|Path|PathPrefix|PathRegexp)\s*\(([^)]*)\)/g;

function readMatchers(rule: string | null): Matcher[] {
  if (rule === null) return [{ kind: "host" }];
  const matchers: Matcher[] = [];
  for (const [, negation, name, rawArgs] of rule.matchAll(MATCHER) as IterableIterator<[string, string | undefined, string, string]>) {
    if (name.startsWith("Host")) {
      if (negation === undefined) matchers.push({ kind: "host" });
      continue;
    }
    const args = [...rawArgs.matchAll(/[`"']([^`"']*)[`"']/g)].map((arg) => arg[1] ?? "");
    matchers.push({ kind: "path", isNegated: negation !== undefined, ...buildPathMatch(name, args) });
  }
  return matchers;
}

function buildPathMatch(name: string, args: readonly string[]): Pick<Extract<Matcher, { kind: "path" }>, "overlaps" | "covers"> {
  if (name === "PathPrefix") {
    return {
      overlaps: (bypassPath) => args.some((prefix) => bypassPath.startsWith(prefix) || prefix.startsWith(bypassPath)),
      covers: (bypassPath) => args.some((prefix) => bypassPath.startsWith(prefix)),
    };
  }
  if (name === "Path") {
    return { overlaps: (bypassPath) => args.some((path) => path.startsWith(bypassPath)), covers: () => false };
  }
  const patterns = args.flatMap((source) => {
    try {
      return [new RegExp(source)];
    } catch {
      // A Go-only regular expression JavaScript cannot compile is read as matching nothing; documented in the README.
      return [];
    }
  });
  return { overlaps: (bypassPath) => patterns.some((pattern) => pattern.test(bypassPath)), covers: () => false };
}

/** Whether a router with these matchers answers some request under the bypass path (on some host). */
function servesPath(matchers: readonly Matcher[], bypassPath: string): boolean {
  const pathMatchers = matchers.filter((matcher) => matcher.kind === "path");
  if (pathMatchers.some((matcher) => matcher.isNegated && matcher.covers(bypassPath))) return false;
  const positive = pathMatchers.filter((matcher) => !matcher.isNegated);
  return positive.length === 0 || positive.some((matcher) => matcher.overlaps(bypassPath));
}

function readLabels(definition: Record<string, unknown>): Map<string, string> {
  const labels = new Map<string, string>();
  const deploy = isRecord(definition.deploy) ? definition.deploy : {};
  for (const source of [definition.labels, deploy.labels]) {
    if (Array.isArray(source)) {
      for (const entry of source) {
        if (typeof entry !== "string") continue;
        const separator = entry.indexOf("=");
        if (separator > 0) labels.set(entry.slice(0, separator).trim(), entry.slice(separator + 1).trim());
      }
    } else if (isRecord(source)) {
      for (const [key, value] of Object.entries(source)) labels.set(key, formatScalar(value));
    }
  }
  return labels;
}

function formatScalar(value: unknown): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter((item) => item !== "");
}

function formatPort(port: unknown): string {
  if (isRecord(port)) return [port.host_ip, port.published, port.target].filter((part) => part !== undefined).map(String).join(":");
  return String(port);
}

function topLevel(rule: ComposeRule, message: string): ComposeViolation {
  return { rule, service: null, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
