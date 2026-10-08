// DNS for AI Discovery (draft-mozleywilliams-dnsop-dnsaid-02, SVCB of RFC 9460): records under `_agents.<domain>`
// that point agents at the service index and the MCP server, and the evaluation of DNS-over-HTTPS answers the way
// agent-readiness scanners count it. Pure: the queries run in the CLI.
//
// Decisions: `alpn="h2"`, not the draft's `alpn=mcp` (an ALPN id names a TLS protocol, and MCP is not one); no
// `mandatory` and no `keyNNNNN` parameters, which providers and resolvers handle unevenly.
import { z } from "zod";
import type { AgentReadyOptions } from "./options.js";
import type { AgentOrigins } from "./origins.js";

/** Record types in DoH JSON (IANA numbers). */
export const DNS_TYPE_DS = 43;
export const DNS_TYPE_SVCB = 64;
export const DNS_TYPE_HTTPS = 65;

/** SvcParam keys of RFC 9460 §14.3.2 the evaluation reads. */
const KEY_ALPN = 1;
const KEY_PORT = 3;

export const DNS_AID_ALPN = "h2";
export const DNS_AID_PORT = 443;
export const DNS_AID_TTL = 3600;

export interface DnsAidRecord {
  /** The full owner name, e.g. `_mcp._agents.example.com`. */
  readonly name: string;
  /** The target host, e.g. `app.example.com`. */
  readonly target: string;
  readonly alpn: readonly string[];
  readonly port: number;
  readonly purpose: string;
}

function hostOf(origin: string): string {
  return new URL(origin).hostname;
}

/** The records of the module's `dnsAid` options for the configured origins: `apex` and `app` become their hosts. */
export function resolveDnsAidRecords(options: Pick<AgentReadyOptions, "dnsAid">, origins: Pick<AgentOrigins, "appOrigin" | "apexOrigin">): DnsAidRecord[] {
  const domain = options.dnsAid.domain ?? hostOf(origins.apexOrigin);
  return options.dnsAid.records.map((record) => ({
    name: `${record.label}._agents.${domain}`,
    target: record.target === "apex" ? hostOf(origins.apexOrigin) : record.target === "app" ? hostOf(origins.appOrigin) : record.target,
    alpn: [DNS_AID_ALPN],
    port: DNS_AID_PORT,
    purpose: record.purpose ?? record.label,
  }));
}

/** One zone-file line: exactly what goes into the DNS provider. */
export function formatZoneLine(record: DnsAidRecord): string {
  return `${record.name}. ${DNS_AID_TTL} IN SVCB 1 ${record.target}. alpn="${record.alpn.join(",")}" port=${record.port}`;
}

/** A DoH JSON answer (Cloudflare and Google share the shape). */
export const dohResponseSchema = z.object({
  Status: z.number(),
  AD: z.boolean().optional(),
  Answer: z.array(z.object({ type: z.number(), data: z.string() })).optional(),
});

export type DohResponse = z.infer<typeof dohResponseSchema>;

export interface ResolvedDnsAid {
  /** The SVCB answer for each record name. */
  readonly records: Readonly<Record<string, DohResponse>>;
  /** The DS answer for the domain. */
  readonly ds: DohResponse;
}

export interface SvcbRecord {
  readonly priority: number;
  readonly target: string;
  readonly alpn: readonly string[];
  readonly port: number | null;
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, "");
}

function parseGeneric(declaredLength: number, hex: string): SvcbRecord | null {
  const clean = hex.replace(/\s+/g, "");
  if (!/^(?:[0-9a-f]{2})+$/i.test(clean)) return null;
  const bytes = Uint8Array.from(clean.match(/../g) ?? [], (pair) => parseInt(pair, 16));
  const byteAt = (at: number) => bytes[at] ?? 0;
  const u16 = (at: number) => (byteAt(at) << 8) | byteAt(at + 1);
  if (bytes.length !== declaredLength || bytes.length < 3) return null;

  const priority = u16(0);
  let at = 2;
  const labels: string[] = [];
  while (at < bytes.length && byteAt(at) !== 0) {
    const length = byteAt(at);
    if (at + 1 + length > bytes.length) return null;
    labels.push(String.fromCharCode(...bytes.slice(at + 1, at + 1 + length)));
    at += 1 + length;
  }
  if (at >= bytes.length) return null;
  at += 1;

  const alpn: string[] = [];
  let port: number | null = null;
  while (at + 4 <= bytes.length) {
    const key = u16(at);
    const length = u16(at + 2);
    const value = bytes.slice(at + 4, at + 4 + length);
    if (value.length !== length) return null;
    if (key === KEY_ALPN) {
      let inner = 0;
      while (inner < value.length) {
        const idLength = value[inner] ?? 0;
        if (inner + 1 + idLength > value.length) return null;
        alpn.push(String.fromCharCode(...value.slice(inner + 1, inner + 1 + idLength)));
        inner += 1 + idLength;
      }
    } else if (key === KEY_PORT && length === 2) {
      port = ((value[0] ?? 0) << 8) | (value[1] ?? 0);
    }
    at += 4 + length;
  }
  // Every byte must belong to a field; anything left over means truncated data.
  return at === bytes.length ? { priority, target: labels.join("."), alpn, port } : null;
}

/** Whitespace-separated tokens; split, not a pattern, so a resolver's answer cannot make the parse slow. */
function tokenize(data: string): string[] {
  return data.split(/\s/).filter((token) => token !== "");
}

function parsePresentation(data: string): SvcbRecord | null {
  const [priority = "", target, ...params] = tokenize(data);
  if (!/^\d+$/.test(priority) || target === undefined) return null;
  let alpn: string[] = [];
  let port: number | null = null;
  for (const param of params) {
    const at = param.indexOf("=");
    const key = (at < 0 ? param : param.slice(0, at)).toLowerCase();
    const value = at < 0 ? "" : param.slice(at + 1).replaceAll('"', "");
    if (key === "alpn") alpn = value.split(",").filter(Boolean);
    if (key === "port") port = Number(value);
  }
  return { priority: Number(priority), target: target === "." ? "" : target, alpn, port };
}

/**
 * The `data` of a DoH SVCB or HTTPS answer: the presentation form (`1 app.example.com. alpn="h2" port=443`) or the
 * generic form of RFC 3597 (`\# 31 0001…`), depending on the resolver. Null for anything unreadable or truncated.
 */
export function parseSvcbData(data: string): SvcbRecord | null {
  const [marker, length = "", ...hex] = tokenize(data);
  if (marker !== "\\#") return parsePresentation(data);
  return /^\d+$/.test(length) ? parseGeneric(Number(length), hex.join("")) : null;
}

export interface DnsAidCheck {
  readonly check: string;
  readonly ok: boolean;
  readonly detail: string;
}

function describeEmpty(response: DohResponse): string {
  if (response.Status === 3) return "the name does not exist (NXDOMAIN)";
  if (response.Status === 2) return "the resolver answers SERVFAIL: with DNSSEC usually a wrong DS at the registrar";
  if (response.Status !== 0) return `the resolver answers with code ${response.Status}`;
  return "no record";
}

function evaluateRecord(expected: DnsAidRecord, response: DohResponse | undefined): DnsAidCheck[] {
  const label = expected.name.split(".")[0] ?? expected.name;
  const answers = (response?.Answer ?? []).filter((answer) => answer.type === DNS_TYPE_SVCB || answer.type === DNS_TYPE_HTTPS);
  const parsed = answers.map((answer) => parseSvcbData(answer.data)).filter((record): record is SvcbRecord => record !== null);
  const found = parsed.find((record) => normalizeHost(record.target) === normalizeHost(expected.target));
  const service = found ?? parsed.find((record) => record.priority > 0) ?? parsed[0];

  const present: DnsAidCheck = {
    check: `${label} record`,
    ok: parsed.length > 0,
    detail: parsed.length > 0 ? `${parsed.length} SVCB/HTTPS record(s)` : describeEmpty(response ?? { Status: 0 }),
  };
  if (service === undefined) {
    const missing = "no record";
    return [
      present,
      { check: `${label} ServiceMode`, ok: false, detail: missing },
      { check: `${label} target`, ok: false, detail: `${missing}; expected ${expected.target}.` },
      { check: `${label} alpn+port`, ok: false, detail: missing },
      { check: `${label} DNSSEC`, ok: false, detail: missing },
    ];
  }
  const hasAlpn = service.alpn.includes(DNS_AID_ALPN);
  const isServiceMode = service.priority >= 1;
  return [
    present,
    {
      check: `${label} ServiceMode`,
      ok: isServiceMode,
      detail: isServiceMode ? `priority ${service.priority}` : "priority 0 is AliasMode, which scanners refuse",
    },
    { check: `${label} target`, ok: found !== undefined, detail: `${service.target || "."} (expected ${expected.target}.)` },
    {
      check: `${label} alpn+port`,
      ok: hasAlpn && service.port === DNS_AID_PORT,
      detail: `alpn=${service.alpn.join(",") || "-"} port=${service.port ?? "-"} (expected ${DNS_AID_ALPN} and ${DNS_AID_PORT})`,
    },
    {
      check: `${label} DNSSEC`,
      ok: response?.AD === true,
      detail: response?.AD === true ? "AD: true" : "AD: false, the answer is not authenticated",
    },
  ];
}

/** The conditions scanners count for DNS-AID: per record presence, ServiceMode, target, alpn and port, DNSSEC; then DS. */
export function evaluateDnsAid(records: readonly DnsAidRecord[], resolved: ResolvedDnsAid): DnsAidCheck[] {
  const checks = records.flatMap((expected) => evaluateRecord(expected, resolved.records[expected.name]));
  const ds = (resolved.ds.Answer ?? []).filter((answer) => answer.type === DNS_TYPE_DS);
  checks.push({
    check: "DS at the registrar",
    ok: ds.length > 0,
    detail: ds.length > 0 ? `${ds.length} DS record(s) in the parent zone` : describeEmpty(resolved.ds),
  });
  return checks;
}
