// `agent-ready`: the checks that need a computation or a resolver, which a deploy's route check cannot make.
//
//   agent-ready web-bot-auth key                               a new Ed25519 seed for WEB_BOT_AUTH_PRIVATE_KEY
//   agent-ready dns-aid check --domain example.com --record _mcp=app.example.com [--record …]
//   agent-ready check https://example.com                      skill digests and the directory signature
//
// Exit codes: 0 everything holds, 1 a check failed, 2 wrong usage.
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { digestOf } from "../agent-skills.js";
import {
  DNS_AID_ALPN,
  DNS_AID_PORT,
  DNS_TYPE_DS,
  DNS_TYPE_SVCB,
  dohResponseSchema,
  evaluateDnsAid,
  formatZoneLine,
  type DnsAidRecord,
  type DohResponse,
} from "../dns-aid.js";
import { AGENT_SKILLS_INDEX_PATH, WEB_BOT_AUTH_DIRECTORY_PATH } from "../paths.js";
import { createWebBotAuthKey, DEFAULT_PRIVATE_KEY_ENV, getAuthority, verifyDirectorySignature } from "../server/web-bot-auth.js";

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

/** The resolver the DNS check asks: DNS-over-HTTPS in JSON. */
export const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface CliOutput {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

export interface RunAgentReadyCliOptions {
  readonly argv: readonly string[];
  readonly output?: CliOutput;
  /** Default: the global `fetch`. */
  readonly fetch?: FetchLike;
  /** Whether standard output is a terminal; the key command refuses one. Default: `process.stdout.isTTY`. */
  readonly isTerminal?: boolean;
  /** 32 random bytes for a key. Default: `crypto.randomBytes`. */
  readonly random?: (size: number) => Buffer;
}

const USAGE = [
  "Usage:",
  "  agent-ready web-bot-auth key > web-bot-auth.env",
  "  agent-ready dns-aid check --domain <domain> --record <label>=<host> [--record …]",
  "  agent-ready check <url>",
].join("\n");

const consoleOutput: CliOutput = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};

function usage(output: CliOutput, problem: string): number {
  output.err(`agent-ready: ${problem}`);
  output.err(USAGE);
  return EXIT_USAGE;
}

/** Prints `NAME=<seed>` for the secret store, and the public key on stderr. Never to a terminal: the seed is a secret. */
function runKey(options: RunAgentReadyCliOptions, output: CliOutput): number {
  if (options.isTerminal ?? process.stdout.isTTY) {
    return usage(output, "the key is a secret and standard output is a terminal; redirect it into a file or your secret store");
  }
  const seed = (options.random ?? randomBytes)(32).toString("base64url");
  const key = createWebBotAuthKey(seed);
  if (key === null) {
    output.err("agent-ready: generating an Ed25519 key failed");
    return EXIT_FAILED;
  }
  output.out(`${DEFAULT_PRIVATE_KEY_ENV}=${seed}`);
  output.err(`public key (x): ${key.publicJwk.x}`);
  output.err(`keyid (RFC 7638 thumbprint): ${key.keyid}`);
  return EXIT_OK;
}

async function queryDoh(fetchImpl: FetchLike, name: string, type: string): Promise<DohResponse> {
  const response = await fetchImpl(`${DOH_ENDPOINT}?name=${encodeURIComponent(name)}&type=${type}&do=1`, { headers: { accept: "application/dns-json" } });
  if (!response.ok) throw new Error(`DNS-over-HTTPS query ${type} ${name}: HTTP ${response.status}`);
  return dohResponseSchema.parse(await response.json());
}

async function runDnsAid(args: readonly string[], fetchImpl: FetchLike, output: CliOutput): Promise<number> {
  let values: { domain?: string | undefined; record?: string[] | undefined };
  try {
    ({ values } = parseArgs({ args: [...args], options: { domain: { type: "string" }, record: { type: "string", multiple: true } }, strict: true }));
  } catch (error) {
    return usage(output, error instanceof Error ? error.message : String(error));
  }
  const domain = values.domain?.toLowerCase().replace(/\.$/, "");
  if (domain === undefined || domain === "" || (values.record ?? []).length === 0) return usage(output, "dns-aid check needs --domain and at least one --record");
  const records: DnsAidRecord[] = [];
  for (const entry of values.record ?? []) {
    const match = /^(_[a-z0-9-]+)=([a-z0-9.-]+)$/i.exec(entry);
    if (match === null) return usage(output, `--record ${entry} is not <label>=<host>, e.g. _mcp=app.example.com`);
    const [, label = "", target = ""] = match;
    records.push({ name: `${label}._agents.${domain}`, target: target.toLowerCase().replace(/\.$/, ""), alpn: [DNS_AID_ALPN], port: DNS_AID_PORT, purpose: label });
  }
  const answers: Record<string, DohResponse> = {};
  let ds: DohResponse;
  try {
    for (const record of records) answers[record.name] = await queryDoh(fetchImpl, record.name, String(DNS_TYPE_SVCB));
    ds = await queryDoh(fetchImpl, domain, String(DNS_TYPE_DS));
  } catch (error) {
    output.err(`agent-ready: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT_FAILED;
  }
  const checks = evaluateDnsAid(records, { records: answers, ds });
  for (const check of checks) output.out(`${check.ok ? "ok  " : "FAIL"} ${check.check}: ${check.detail}`);
  const failed = checks.filter((check) => !check.ok).length;
  if (failed > 0) {
    output.out("");
    output.out("Expected records (zone file):");
    for (const record of records) output.out(`  ${formatZoneLine(record)}`);
  }
  output.out(failed === 0 ? `DNS-AID: all ${checks.length} checks pass` : `DNS-AID: ${failed} of ${checks.length} checks fail`);
  return failed === 0 ? EXIT_OK : EXIT_FAILED;
}

interface CheckLine {
  readonly ok: boolean;
  readonly line: string;
}

async function checkSkills(fetchImpl: FetchLike, origin: string): Promise<CheckLine[]> {
  const response = await fetchImpl(`${origin}${AGENT_SKILLS_INDEX_PATH}`);
  if (!response.ok) return [{ ok: false, line: `skills index: HTTP ${response.status}` }];
  const index = (await response.json()) as { skills?: Array<{ name?: unknown; url?: unknown; digest?: unknown }> };
  const lines: CheckLine[] = [];
  for (const skill of index.skills ?? []) {
    const name = String(skill.name);
    if (typeof skill.url !== "string") {
      lines.push({ ok: false, line: `skill ${name}: no url` });
      continue;
    }
    const file = await fetchImpl(new URL(skill.url, origin).href);
    if (!file.ok) {
      lines.push({ ok: false, line: `skill ${name}: HTTP ${file.status}` });
      continue;
    }
    const digest = digestOf(await file.text());
    lines.push({ ok: digest === skill.digest, line: `skill ${name}: ${digest === skill.digest ? "digest matches" : `index ${String(skill.digest)}, file ${digest}`}` });
  }
  return lines.length === 0 ? [{ ok: false, line: "skills index: no skills" }] : lines;
}

async function checkDirectory(fetchImpl: FetchLike, origin: string): Promise<CheckLine> {
  const response = await fetchImpl(`${origin}${WEB_BOT_AUTH_DIRECTORY_PATH}`);
  if (response.status === 404) return { ok: true, line: "signature directory: 404, no key configured (skipped)" };
  if (!response.ok) return { ok: false, line: `signature directory: HTTP ${response.status}` };
  const result = verifyDirectorySignature({
    authority: getAuthority(origin),
    signatureInput: response.headers.get("signature-input"),
    signature: response.headers.get("signature"),
    body: await response.json(),
  });
  return { ok: result.ok, line: `signature directory: ${result.detail}` };
}

async function runCheck(args: readonly string[], fetchImpl: FetchLike, output: CliOutput): Promise<number> {
  const [target, ...extra] = args;
  if (target === undefined || extra.length > 0 || !URL.canParse(target) || !/^https?:$/.test(new URL(target).protocol)) {
    return usage(output, "check needs one http(s) URL");
  }
  const origin = new URL(target).origin;
  let lines: CheckLine[];
  try {
    lines = [...(await checkSkills(fetchImpl, origin)), await checkDirectory(fetchImpl, origin)];
  } catch (error) {
    output.err(`agent-ready: checking ${origin} failed: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT_FAILED;
  }
  for (const { ok, line } of lines) output.out(`${ok ? "ok  " : "FAIL"} ${line}`);
  return lines.every((line) => line.ok) ? EXIT_OK : EXIT_FAILED;
}

export async function runAgentReadyCli(options: RunAgentReadyCliOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  const [command, subcommand, ...rest] = options.argv;
  if (command === "web-bot-auth" && subcommand === "key" && rest.length === 0) return runKey(options, output);
  if (command === "dns-aid" && subcommand === "check") return runDnsAid(rest, fetchImpl, output);
  if (command === "check") return runCheck(options.argv.slice(1), fetchImpl, output);
  return usage(output, command === undefined ? "no command" : `unknown command "${options.argv.join(" ")}"`);
}
