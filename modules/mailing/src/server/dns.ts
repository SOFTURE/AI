// The sender domain's DNS, as receivers check it: SPF (RFC 7208), DKIM (RFC 6376) and DMARC
// (RFC 7489). Without all three, list mail lands in spam or is refused outright. On request it also
// holds DMARC to a required minimum, checks that the reply-to domain accepts mail (MX) and that the
// provider's return-path hosts resolve, and that an inbound service (Cloudflare Email Routing)
// receives the reply domain's mail. The check only reads public records; it cannot see whether
// the provider signs with the published key.
import { resolveCname as resolveCnameRecords, resolveMx as resolveMxRecords, resolveTxt as resolveTxtRecords } from "node:dns/promises";

export type DnsCheckStatus = "pass" | "warn" | "fail";

export type DnsFinding =
  | "found"
  | "missing"
  | "multiple"
  | "permissive"
  | "revoked"
  | "monitor-only"
  | "inherited"
  | "weak"
  | "null-mx"
  | "unexpected-target"
  | "missing-include"
  | "lookup-failed";

export interface DnsCheck {
  readonly status: DnsCheckStatus;
  readonly finding: DnsFinding;
  /** The name that answered (or the first one asked, when none did). */
  readonly host: string;
  /** The record that decided the status, when there is one. */
  readonly record: string | null;
}

export interface SenderDnsReport {
  readonly domain: string;
  readonly spf: DnsCheck;
  readonly dkim: DnsCheck;
  readonly dmarc: DnsCheck;
  /** The reply-to domain's MX, when `replyTo` was given. */
  readonly replyTo: DnsCheck | null;
  /** One check per `returnPath` host, in the order given. */
  readonly returnPath: readonly DnsCheck[];
  /** The inbound service's MX and SPF checks, in that order, when `inbound` was given; `[]` otherwise. */
  readonly inbound: readonly DnsCheck[];
}

/** A service that receives the domain's mail: `cloudflare` is Cloudflare Email Routing. */
export type InboundService = "cloudflare";

export type ResolveTxt = (hostname: string) => Promise<string[][]>;
export interface MxRecord {
  readonly exchange: string;
  readonly priority: number;
}
export type ResolveMx = (hostname: string) => Promise<MxRecord[]>;
export type ResolveCname = (hostname: string) => Promise<string[]>;

export type DmarcPolicy = "quarantine" | "reject";
export type DmarcAlignment = "r" | "s";

/** The least a DMARC record must carry; a weaker one fails as `weak`. Absent tags count as their defaults. */
export interface DmarcExpectation {
  /** The policy for the checked domain: `p`, or `sp ?? p` of a parent's record. Also requires `pct` 100. */
  readonly policy?: DmarcPolicy;
  /** The policy for subdomains: `sp ?? p`. */
  readonly subdomainPolicy?: DmarcPolicy;
  /** `adkim`; absent means relaxed (`r`). */
  readonly adkim?: DmarcAlignment;
  /** `aspf`; absent means relaxed (`r`). */
  readonly aspf?: DmarcAlignment;
}

/** A host the provider uses for MAIL FROM or bounces. */
export interface ReturnPathHost {
  readonly host: string;
  /** When set, a CNAME must point at this domain or under it (`rmta.net` accepts `send.forge.rmta.net`). */
  readonly targetDomain?: string;
}

export interface CheckSenderDnsOptions {
  /** DKIM selectors to look up under `_domainkey`. Default `["resend"]`, the Resend selector. */
  readonly dkimSelectors?: readonly string[];
  /**
   * Where SPF is published. Default: the domain itself. Resend checks SPF on `send.<domain>` (its
   * return path); DMARC accepts that in relaxed alignment.
   */
  readonly spfHosts?: readonly string[];
  /** Turns a DMARC record weaker than this into a `fail` (e.g. `{ policy: "reject", adkim: "s", aspf: "s" }`). */
  readonly expectDmarc?: DmarcExpectation;
  /**
   * Where replies go (an address, `Name <address>` or a domain): its domain must have MX records and at most one
   * SPF record, or replies bounce while the sender checks pass.
   */
  readonly replyTo?: string;
  /** Hosts that must resolve as a CNAME or with MX records; `resendReturnPath(domain)` gives Resend's. */
  readonly returnPath?: readonly ReturnPathHost[];
  /**
   * Checks that this service receives mail for the reply-to domain (else the checked domain): every MX record is the
   * service's, and the one SPF record includes the service's, so replies arrive and forwarding passes SPF.
   */
  readonly inbound?: InboundService;
  readonly resolveTxt?: ResolveTxt;
  readonly resolveMx?: ResolveMx;
  readonly resolveCname?: ResolveCname;
}

export const DEFAULT_DKIM_SELECTORS: readonly string[] = ["resend"];

/** Domain of the CNAME targets Resend publishes for its return-path hosts. */
export const RESEND_RETURN_PATH_DOMAIN = "rmta.net";

/**
 * Resend's return-path hosts: `send.<domain>` (MAIL FROM) and `rsend.<domain>`, CNAMEs to `*.rmta.net`. Domains
 * set up before Resend published `rsend` have MX records on `send` and no `rsend`: check `send` alone there.
 */
export function resendReturnPath(domain: string): ReturnPathHost[] {
  const name = normalizeHost(domain);
  return [
    { host: `send.${name}`, targetDomain: RESEND_RETURN_PATH_DOMAIN },
    { host: `rsend.${name}`, targetDomain: RESEND_RETURN_PATH_DOMAIN },
  ];
}

/** Cloudflare Email Routing: its MX hosts (`route1.mx.cloudflare.net`, ...) and the SPF include it asks for. */
export const CLOUDFLARE_INBOUND = { mxDomain: "mx.cloudflare.net", spfInclude: "_spf.mx.cloudflare.net" } as const;

const INBOUND_SERVICES: Readonly<Record<InboundService, { readonly mxDomain: string; readonly spfInclude: string }>> = { cloudflare: CLOUDFLARE_INBOUND };

/** Reads the SPF, DKIM and DMARC records of `domain`. Never throws: a failed lookup is a finding. */
export async function checkSenderDns(domain: string, options: CheckSenderDnsOptions = {}): Promise<SenderDnsReport> {
  const name = normalizeHost(domain);
  const resolveTxt = options.resolveTxt ?? resolveTxtRecords;
  const lookup = (host: string) => lookupTxt(resolveTxt, host);
  const lookupMx = (host: string) => lookupRecords(options.resolveMx ?? resolveMxRecords, host);
  const lookupCname = (host: string) => lookupRecords(options.resolveCname ?? resolveCnameRecords, host);
  const replyDomain = options.replyTo === undefined ? null : normalizeHost(getSenderDomain(options.replyTo));
  const [spf, dkim, dmarc, replyTo, returnPath, inbound] = await Promise.all([
    checkSpf(lookup, options.spfHosts ?? [name]),
    checkDkim(lookup, (options.dkimSelectors ?? DEFAULT_DKIM_SELECTORS).map((selector) => `${selector}._domainkey.${name}`)),
    checkDmarc(lookup, name, options.expectDmarc),
    replyDomain === null ? null : checkReplyPath(lookup, lookupMx, replyDomain),
    Promise.all((options.returnPath ?? []).map((path) => checkReturnPath(lookupCname, lookupMx, path))),
    options.inbound === undefined ? [] : checkInbound({ lookup, lookupMx }, replyDomain ?? name, INBOUND_SERVICES[options.inbound]),
  ]);
  return { domain: name, spf, dkim, dmarc, replyTo, returnPath, inbound };
}

/** The domain part of a sender (`Plan <hello@mail.example.com>` gives `mail.example.com`). */
export function getSenderDomain(from: string): string {
  // Index arithmetic, not a regular expression: `from` may come from anywhere, and a pattern over
  // `<...>` backtracks polynomially on input like "<<<<".
  const open = from.lastIndexOf("<");
  const close = from.lastIndexOf(">");
  const address = open !== -1 && close > open ? from.slice(open + 1, close) : from;
  return address.slice(address.lastIndexOf("@") + 1).trim().toLowerCase();
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}

type Answer<T> = { readonly kind: "records"; readonly records: T[] } | { readonly kind: "none" } | { readonly kind: "error" };
type TxtAnswer = Answer<string>;
type Lookup = (host: string) => Promise<TxtAnswer>;
type MxLookup = (host: string) => Promise<Answer<MxRecord>>;
type CnameLookup = (host: string) => Promise<Answer<string>>;

const NO_RECORD_CODES = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

async function lookupRecords<T>(resolve: (host: string) => Promise<T[]>, host: string): Promise<Answer<T>> {
  try {
    const records = await resolve(host);
    return records.length === 0 ? { kind: "none" } : { kind: "records", records };
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === "string" && NO_RECORD_CODES.has(code) ? { kind: "none" } : { kind: "error" };
  }
}

async function lookupTxt(resolveTxt: ResolveTxt, host: string): Promise<TxtAnswer> {
  // A TXT record may arrive in 255-byte chunks; they form one string.
  return lookupRecords(async (name) => (await resolveTxt(name)).map((chunks) => chunks.join("")), host);
}

function isSpfRecord(record: string): boolean {
  return /^v=spf1(\s|$)/i.test(record.trim());
}

function startsWithTag(record: string, tag: string): boolean {
  return record.trim().toLowerCase().startsWith(tag);
}

/** One `v=spf1` record per host; `+all` (or a bare `all`) lets anyone send as the domain. */
async function checkSpf(lookup: Lookup, hosts: readonly string[]): Promise<DnsCheck> {
  let lookupFailed: string | null = null;
  for (const host of hosts) {
    const answer = await lookup(host);
    if (answer.kind === "error") {
      lookupFailed ??= host;
      continue;
    }
    const records = answer.kind === "records" ? answer.records.filter(isSpfRecord) : [];
    if (records.length > 1) return { status: "fail", finding: "multiple", host, record: null };
    const record = records[0];
    if (record === undefined) continue;
    const permissive = /(^|\s)\+?all(\s|$)/i.test(record);
    return permissive ? { status: "warn", finding: "permissive", host, record } : { status: "pass", finding: "found", host, record };
  }
  return lookupFailed === null ? { status: "fail", finding: "missing", host: hosts[0] ?? "", record: null } : { status: "fail", finding: "lookup-failed", host: lookupFailed, record: null };
}

/** A key record (`p=`) under one of the selectors; an empty `p=` means the key was revoked. */
async function checkDkim(lookup: Lookup, hosts: readonly string[]): Promise<DnsCheck> {
  let fallback: DnsCheck = { status: "fail", finding: "missing", host: hosts[0] ?? "", record: null };
  for (const host of hosts) {
    const answer = await lookup(host);
    if (answer.kind === "error") {
      if (fallback.finding === "missing") fallback = { status: "fail", finding: "lookup-failed", host, record: null };
      continue;
    }
    if (answer.kind === "none") continue;
    const record = answer.records.find((candidate) => /(^|;)\s*p=/i.test(candidate));
    if (record === undefined) continue;
    const key = /(?:^|;)\s*p=([^;]*)/i.exec(record)?.[1]?.trim() ?? "";
    if (key !== "") return { status: "pass", finding: "found", host, record };
    fallback = { status: "fail", finding: "revoked", host, record };
  }
  return fallback;
}

/**
 * `_dmarc.<domain>`, or the nearest parent's record (the organisational domain's policy, with
 * `sp=` for subdomains when it is set). `p=none` only reports; it protects nothing. With an
 * expectation, a record weaker than it fails as `weak`.
 */
async function checkDmarc(lookup: Lookup, domain: string, expected: DmarcExpectation | undefined): Promise<DnsCheck> {
  const labels = domain.split(".");
  const first = `_dmarc.${domain}`;
  for (let index = 0; index <= labels.length - 2; index += 1) {
    const host = `_dmarc.${labels.slice(index).join(".")}`;
    const answer = await lookup(host);
    if (answer.kind === "error") return { status: "fail", finding: "lookup-failed", host, record: null };
    if (answer.kind === "none") continue;
    const records = answer.records.filter((record) => startsWithTag(record, "v=dmarc1"));
    if (records.length > 1) return { status: "fail", finding: "multiple", host, record: null };
    const record = records[0];
    if (record === undefined) continue;
    const inherited = host !== first;
    const tags = readDmarcTags(record);
    const policy = (inherited ? (tags.get("sp") ?? tags.get("p")) : tags.get("p")) ?? "none";
    if (expected !== undefined && !meetsDmarcExpectation(tags, policy, expected)) return { status: "fail", finding: "weak", host, record };
    if (policy === "none") return { status: "warn", finding: "monitor-only", host, record };
    return inherited ? { status: "pass", finding: "inherited", host, record } : { status: "pass", finding: "found", host, record };
  }
  return { status: "fail", finding: "missing", host: first, record: null };
}

/** `tag=value` pairs of a DMARC record, names and values lower-cased; the first occurrence wins. */
function readDmarcTags(record: string): Map<string, string> {
  const tags = new Map<string, string>();
  for (const part of record.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim().toLowerCase();
    if (!tags.has(name)) tags.set(name, part.slice(separator + 1).trim().toLowerCase());
  }
  return tags;
}

const POLICY_RANK: Readonly<Record<string, number>> = { none: 0, quarantine: 1, reject: 2 };

/** An unknown policy value counts as `none`, as receivers treat an invalid `p=`. */
function rankPolicy(policy: string | undefined): number {
  return (policy === undefined ? undefined : POLICY_RANK[policy]) ?? 0;
}

function meetsAlignment(actual: string | undefined, expected: DmarcAlignment | undefined): boolean {
  return expected !== "s" || actual === "s";
}

function meetsDmarcExpectation(tags: ReadonlyMap<string, string>, policy: string, expected: DmarcExpectation): boolean {
  if (expected.policy !== undefined) {
    if (rankPolicy(policy) < rankPolicy(expected.policy)) return false;
    const percent = tags.get("pct");
    if (percent !== undefined && Number(percent) !== 100) return false;
  }
  if (expected.subdomainPolicy !== undefined && rankPolicy(tags.get("sp") ?? tags.get("p")) < rankPolicy(expected.subdomainPolicy)) return false;
  return meetsAlignment(tags.get("adkim"), expected.adkim) && meetsAlignment(tags.get("aspf"), expected.aspf);
}

function formatMx(records: readonly MxRecord[]): string {
  return [...records]
    .sort((left, right) => left.priority - right.priority)
    .map((record) => `${String(record.priority)} ${normalizeHost(record.exchange) || "."}`)
    .join(", ");
}

/** A null MX (RFC 7505: one record, exchange `.`) says the domain accepts no mail. Node reports it as `""`. */
function isNullMx(records: readonly MxRecord[]): boolean {
  return records.length === 1 && normalizeHost(records[0]?.exchange ?? "") === "";
}

/** The reply-to domain must accept mail (MX, not a null MX) and publish at most one SPF record. */
async function checkReplyPath(lookup: Lookup, lookupMx: MxLookup, host: string): Promise<DnsCheck> {
  const mx = await lookupMx(host);
  if (mx.kind === "error") return { status: "fail", finding: "lookup-failed", host, record: null };
  if (mx.kind === "none") return { status: "fail", finding: "missing", host, record: null };
  if (isNullMx(mx.records)) return { status: "fail", finding: "null-mx", host, record: formatMx(mx.records) };
  const txt = await lookup(host);
  if (txt.kind === "error") return { status: "fail", finding: "lookup-failed", host, record: null };
  if (txt.kind === "records" && txt.records.filter(isSpfRecord).length > 1) return { status: "fail", finding: "multiple", host, record: null };
  return { status: "pass", finding: "found", host, record: formatMx(mx.records) };
}

/** A CNAME (to `targetDomain` or under it, when set), else MX records. Strings, not patterns: the domain is input. */
async function checkReturnPath(lookupCname: CnameLookup, lookupMx: MxLookup, path: ReturnPathHost): Promise<DnsCheck> {
  const host = normalizeHost(path.host);
  const cname = await lookupCname(host);
  if (cname.kind === "error") return { status: "fail", finding: "lookup-failed", host, record: null };
  if (cname.kind === "records") {
    const target = normalizeHost(cname.records[0] ?? "");
    const expected = path.targetDomain === undefined ? null : normalizeHost(path.targetDomain);
    const matches = expected === null || target === expected || target.endsWith(`.${expected}`);
    return matches ? { status: "pass", finding: "found", host, record: target } : { status: "fail", finding: "unexpected-target", host, record: target };
  }
  const mx = await lookupMx(host);
  if (mx.kind === "error") return { status: "fail", finding: "lookup-failed", host, record: null };
  if (mx.kind === "none" || isNullMx(mx.records)) return { status: "fail", finding: "missing", host, record: null };
  return { status: "pass", finding: "found", host, record: formatMx(mx.records) };
}

/** Whether `host` is `domain` or under it. Strings, not patterns: the domain is input. */
function isUnder(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** The inbound service's MX (every record its own) and SPF (exactly one record, including the service's). */
async function checkInbound(
  { lookup, lookupMx }: { readonly lookup: Lookup; readonly lookupMx: MxLookup },
  host: string,
  service: { readonly mxDomain: string; readonly spfInclude: string },
): Promise<DnsCheck[]> {
  const [mx, txt] = await Promise.all([lookupMx(host), lookup(host)]);
  return [checkInboundMx(mx, host, service.mxDomain), checkInboundSpf(txt, host, service.spfInclude)];
}

function checkInboundMx(mx: Answer<MxRecord>, host: string, mxDomain: string): DnsCheck {
  if (mx.kind === "error") return { status: "fail", finding: "lookup-failed", host, record: null };
  if (mx.kind === "none") return { status: "fail", finding: "missing", host, record: null };
  const record = formatMx(mx.records);
  if (isNullMx(mx.records)) return { status: "fail", finding: "null-mx", host, record };
  const isService = mx.records.every((entry) => isUnder(normalizeHost(entry.exchange), mxDomain));
  return isService ? { status: "pass", finding: "found", host, record } : { status: "fail", finding: "unexpected-target", host, record };
}

function checkInboundSpf(txt: TxtAnswer, host: string, include: string): DnsCheck {
  if (txt.kind === "error") return { status: "fail", finding: "lookup-failed", host, record: null };
  const records = txt.kind === "records" ? txt.records.filter(isSpfRecord) : [];
  if (records.length > 1) return { status: "fail", finding: "multiple", host, record: null };
  const record = records[0];
  if (record === undefined) return { status: "fail", finding: "missing", host, record: null };
  const includes = record
    .trim()
    .split(/\s+/)
    .some((term) => term.toLowerCase().replace(/^\+/, "").replace(/\.$/, "") === `include:${include}`);
  return includes ? { status: "pass", finding: "found", host, record } : { status: "fail", finding: "missing-include", host, record };
}
