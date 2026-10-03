// The sender domain's DNS, as receivers check it: SPF (RFC 7208), DKIM (RFC 6376) and DMARC
// (RFC 7489). Without all three, list mail lands in spam or is refused outright. The check only
// reads public TXT records; it cannot see whether the provider signs with the published key.
import { resolveTxt as resolveTxtRecords } from "node:dns/promises";

export type DnsCheckStatus = "pass" | "warn" | "fail";

export type DnsFinding =
  | "found"
  | "missing"
  | "multiple"
  | "permissive"
  | "revoked"
  | "monitor-only"
  | "inherited"
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
}

export type ResolveTxt = (hostname: string) => Promise<string[][]>;

export interface CheckSenderDnsOptions {
  /** DKIM selectors to look up under `_domainkey`. Default `["resend"]`, the Resend selector. */
  readonly dkimSelectors?: readonly string[];
  /**
   * Where SPF is published. Default: the domain itself. Resend checks SPF on `send.<domain>` (its
   * return path); DMARC accepts that in relaxed alignment.
   */
  readonly spfHosts?: readonly string[];
  readonly resolveTxt?: ResolveTxt;
}

export const DEFAULT_DKIM_SELECTORS: readonly string[] = ["resend"];

/** Reads the SPF, DKIM and DMARC records of `domain`. Never throws: a failed lookup is a finding. */
export async function checkSenderDns(domain: string, options: CheckSenderDnsOptions = {}): Promise<SenderDnsReport> {
  const name = domain.trim().toLowerCase().replace(/\.$/, "");
  const resolveTxt = options.resolveTxt ?? resolveTxtRecords;
  const lookup = (host: string) => lookupTxt(resolveTxt, host);
  const [spf, dkim, dmarc] = await Promise.all([
    checkSpf(lookup, options.spfHosts ?? [name]),
    checkDkim(lookup, (options.dkimSelectors ?? DEFAULT_DKIM_SELECTORS).map((selector) => `${selector}._domainkey.${name}`)),
    checkDmarc(lookup, name),
  ]);
  return { domain: name, spf, dkim, dmarc };
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

type Lookup = (host: string) => Promise<TxtAnswer>;
type TxtAnswer = { readonly kind: "records"; readonly records: string[] } | { readonly kind: "none" } | { readonly kind: "error" };

const NO_RECORD_CODES = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

async function lookupTxt(resolveTxt: ResolveTxt, host: string): Promise<TxtAnswer> {
  try {
    // A TXT record may arrive in 255-byte chunks; they form one string.
    const records = (await resolveTxt(host)).map((chunks) => chunks.join(""));
    return records.length === 0 ? { kind: "none" } : { kind: "records", records };
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === "string" && NO_RECORD_CODES.has(code) ? { kind: "none" } : { kind: "error" };
  }
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
    const records = answer.kind === "records" ? answer.records.filter((record) => /^v=spf1(\s|$)/i.test(record.trim())) : [];
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
 * `sp=` for subdomains when it is set). `p=none` only reports; it protects nothing.
 */
async function checkDmarc(lookup: Lookup, domain: string): Promise<DnsCheck> {
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
    const tag = (name: string) => new RegExp(`(?:^|;)\\s*${name}=([^;]*)`, "i").exec(record)?.[1]?.trim().toLowerCase();
    const policy = (inherited ? (tag("sp") ?? tag("p")) : tag("p")) ?? "none";
    if (policy === "none") return { status: "warn", finding: "monitor-only", host, record };
    return inherited ? { status: "pass", finding: "inherited", host, record } : { status: "pass", finding: "found", host, record };
  }
  return { status: "fail", finding: "missing", host: first, record: null };
}
