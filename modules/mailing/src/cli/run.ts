// `softure-mail`: sends a campaign from a content file and checks the sender domain's DNS. The app
// passes its validated config, so the same function serves the bin and an app script that a
// bundler packs for a container:
//
//   // scripts/mail.ts
//   import { runMailCli } from "@softure-ai/mailing/cli";
//   import config from "../softure.config";
//   process.exitCode = await runMailCli({ config, argv: process.argv.slice(2) });
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { systemClock, type SoftureConfig, type SoftureDatabaseConfig } from "@softure-ai/core";
import { openCommandDatabase, type CommandDatabase, type DatabaseHandle } from "@softure-ai/db";
import { parseCampaignFile, parseRecipientList, type CampaignContent } from "../server/campaign-file.js";
import { planCampaign, sendCampaign, type CampaignSummary } from "../server/campaigns.js";
import type { DeliveryContext, HaltingErrorCode } from "../server/deliveries.js";
import { checkSenderDns, getSenderDomain, resendReturnPath, type DmarcAlignment, type DmarcExpectation, type DmarcPolicy, type DnsCheck, type ResolveCname, type ResolveMx, type ResolveTxt, type ReturnPathHost } from "../server/dns.js";
import { getMailingOptions } from "../server/options.js";
import { MIN_UNSUBSCRIBE_SECRET_LENGTH, readUnsubscribeSecrets, UNSUBSCRIBE_SECRET_ENV, type Env } from "../server/unsubscribe-link.js";

export interface CliOutput {
  readonly log: (line: string) => void;
  readonly error: (line: string) => void;
}

export interface RunMailCliOptions {
  /** The app's config. Needed by `campaign`, and by `dns` without `--domain`. */
  readonly config?: SoftureConfig;
  /** The arguments after the executable, e.g. `["campaign", "launch.md", "--recipients", "list.txt"]`. */
  readonly argv: readonly string[];
  /** Relative paths resolve against it. Default: `process.cwd()`. */
  readonly cwd?: string;
  readonly output?: CliOutput;
  /** Opens the campaign's database connection. Default: the config's `database.handle`, else `createDatabase(url, { max: 1 })`. */
  readonly openDatabase?: (url: string) => Promise<DatabaseHandle>;
  readonly resolveTxt?: ResolveTxt;
  readonly resolveMx?: ResolveMx;
  readonly resolveCname?: ResolveCname;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly env?: Env;
}

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

/** Pause between sends: Resend's default limit is two requests per second. */
export const DEFAULT_PAUSE_MS = 500;

export const MAIL_USAGE = `Usage:
  softure-mail campaign <content-file> --recipients <file> [--dry-run] [--pause-ms <ms>] [--resend-uncertain]
  softure-mail dns [--domain <domain>] [--dkim-selector <name>]... [--spf-host <host>]...
                   [--dmarc-policy <p>] [--dmarc-sp <p>] [--dmarc-adkim <a>] [--dmarc-aspf <a>]
                   [--reply-to <address>] [--return-path <host>]... [--resend-return-path]

campaign  Sends the campaign in <content-file> (frontmatter id, kind, subject, optional html,
          then the text body) to every address in the recipients file (one per line), at most
          once each. Re-running sends only to recipients without an outcome yet. A refused
          API key or a spent quota stops the run; the rest go out on the next one.
  --dry-run            count what would be sent and change nothing
  --pause-ms <ms>      pause after every send (default ${String(DEFAULT_PAUSE_MS)})
  --resend-uncertain   also send to recipients whose send was interrupted long ago
                       (it may have gone out: they may get the mail twice)

dns       Checks SPF, DKIM and DMARC for the sender domain (default: the domain of "from").
  --domain <domain>       check this domain instead
  --dkim-selector <name>  DKIM selector to look up (default resend; repeatable)
  --spf-host <host>       where SPF is published (default the domain; repeatable;
                          Resend publishes it on send.<domain>)
  --dmarc-policy <p>      require at least this DMARC policy (quarantine or reject)
                          and pct=100; a weaker record fails
  --dmarc-sp <p>          require at least this subdomain policy (sp, else p)
  --dmarc-adkim <a>       require this DKIM alignment (r or s; absent counts as r)
  --dmarc-aspf <a>        require this SPF alignment (r or s; absent counts as r)
  --reply-to <address>    check that this address's domain accepts mail (MX, one SPF)
                          (default: replyTo of the config, when --domain is not given)
  --return-path <host>    a return-path host that must be a CNAME or have MX (repeatable)
  --resend-return-path    check Resend's send.<domain> and rsend.<domain> CNAMEs

Options for both:
  --config <file>    the app's softure.config file (bin only)
  --help             show this help`;

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

type Command =
  | { readonly kind: "help" }
  | {
      readonly kind: "campaign";
      readonly contentFile: string;
      readonly recipientsFile: string;
      readonly dryRun: boolean;
      readonly pauseMs: number;
      readonly resendUncertain: boolean;
    }
  | {
      readonly kind: "dns";
      readonly domain: string | undefined;
      readonly dkimSelectors: readonly string[] | undefined;
      readonly spfHosts: readonly string[] | undefined;
      readonly expectDmarc: DmarcExpectation | undefined;
      readonly replyTo: string | undefined;
      readonly returnPathHosts: readonly string[];
      readonly resendReturnPath: boolean;
    };

const DMARC_POLICIES: readonly DmarcPolicy[] = ["quarantine", "reject"];
const DMARC_ALIGNMENTS: readonly DmarcAlignment[] = ["r", "s"];
const DNS_ONLY_OPTIONS = ["domain", "dkim-selector", "spf-host", "dmarc-policy", "dmarc-sp", "dmarc-adkim", "dmarc-aspf", "reply-to", "return-path", "resend-return-path"] as const;

/** Runs the command and returns the process exit code: 0 done, 1 failed or incomplete, 2 usage error. */
export async function runMailCli(options: RunMailCliOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const command = parseCommand(options.argv);
  if (typeof command === "string") {
    output.error(`softure-mail: ${command}`);
    output.error(MAIL_USAGE);
    return EXIT_USAGE;
  }
  switch (command.kind) {
    case "help":
      output.log(MAIL_USAGE);
      return EXIT_OK;
    case "dns":
      return runDns(command, options, output);
    case "campaign":
      return runCampaign(command, options, output);
  }
}

function parseCommand(argv: readonly string[]): Command | string {
  const [name, ...rest] = argv;
  if (name === undefined) return "missing command; use campaign or dns";
  if (name === "--help") return { kind: "help" };
  if (name !== "campaign" && name !== "dns") return `unknown command "${name}"; use campaign or dns`;

  let parsed: ReturnType<typeof parseCommandArgs>;
  try {
    parsed = parseCommandArgs(rest);
  } catch (error) {
    return describeError(error);
  }
  const { values, positionals } = parsed;
  if (values.help === true) return { kind: "help" };

  if (name === "dns") {
    const misplaced = (["recipients", "dry-run", "pause-ms", "resend-uncertain"] as const).filter((option) => values[option] !== undefined);
    if (misplaced.length > 0) return `dns does not take --${misplaced.join(", --")}`;
    if (positionals.length > 0) return `dns takes no file, got "${positionals.join(" ")}"`;
    const expectDmarc = parseDmarcExpectation(values);
    if (typeof expectDmarc === "string") return expectDmarc;
    return {
      kind: "dns",
      domain: values.domain,
      dkimSelectors: values["dkim-selector"],
      spfHosts: values["spf-host"],
      expectDmarc,
      replyTo: values["reply-to"],
      returnPathHosts: values["return-path"] ?? [],
      resendReturnPath: values["resend-return-path"] === true,
    };
  }

  const misplaced = DNS_ONLY_OPTIONS.filter((option) => values[option] !== undefined);
  if (misplaced.length > 0) return `campaign does not take --${misplaced.join(", --")}`;
  const [contentFile, ...extra] = positionals;
  if (contentFile === undefined) return "campaign needs a content file";
  if (extra.length > 0) return `campaign takes one content file, got also "${extra.join(" ")}"`;
  if (values.recipients === undefined) return "campaign needs --recipients <file>";
  const pauseMs = values["pause-ms"] === undefined ? DEFAULT_PAUSE_MS : Number(values["pause-ms"]);
  if (!Number.isInteger(pauseMs) || pauseMs < 0 || pauseMs > 60_000) return `--pause-ms expects whole milliseconds from 0 to 60000, got "${values["pause-ms"] ?? ""}"`;
  return { kind: "campaign", contentFile, recipientsFile: values.recipients, dryRun: values["dry-run"] === true, pauseMs, resendUncertain: values["resend-uncertain"] === true };
}

function parseCommandArgs(args: readonly string[]) {
  return parseArgs({
    args: [...args],
    options: {
      recipients: { type: "string" },
      "dry-run": { type: "boolean" },
      "pause-ms": { type: "string" },
      "resend-uncertain": { type: "boolean" },
      domain: { type: "string" },
      "dkim-selector": { type: "string", multiple: true },
      "spf-host": { type: "string", multiple: true },
      "dmarc-policy": { type: "string" },
      "dmarc-sp": { type: "string" },
      "dmarc-adkim": { type: "string" },
      "dmarc-aspf": { type: "string" },
      "reply-to": { type: "string" },
      "return-path": { type: "string", multiple: true },
      "resend-return-path": { type: "boolean" },
      help: { type: "boolean" },
    },
    strict: true,
    allowPositionals: true,
  });
}

type ParsedValues = ReturnType<typeof parseCommandArgs>["values"];

/** One choice of a fixed list, case-insensitive; `undefined` when the option was not given. */
function pickChoice<T extends string>(values: ParsedValues, option: "dmarc-policy" | "dmarc-sp" | "dmarc-adkim" | "dmarc-aspf", allowed: readonly T[]): { readonly value: T | undefined } | string {
  const given = values[option];
  if (given === undefined) return { value: undefined };
  const found = allowed.find((candidate) => candidate === given.trim().toLowerCase());
  return found === undefined ? `--${option} expects ${allowed.join(" or ")}, got "${given}"` : { value: found };
}

function parseDmarcExpectation(values: ParsedValues): DmarcExpectation | undefined | string {
  const policy = pickChoice(values, "dmarc-policy", DMARC_POLICIES);
  if (typeof policy === "string") return policy;
  const subdomainPolicy = pickChoice(values, "dmarc-sp", DMARC_POLICIES);
  if (typeof subdomainPolicy === "string") return subdomainPolicy;
  const adkim = pickChoice(values, "dmarc-adkim", DMARC_ALIGNMENTS);
  if (typeof adkim === "string") return adkim;
  const aspf = pickChoice(values, "dmarc-aspf", DMARC_ALIGNMENTS);
  if (typeof aspf === "string") return aspf;
  const expectation: DmarcExpectation = {
    ...(policy.value === undefined ? {} : { policy: policy.value }),
    ...(subdomainPolicy.value === undefined ? {} : { subdomainPolicy: subdomainPolicy.value }),
    ...(adkim.value === undefined ? {} : { adkim: adkim.value }),
    ...(aspf.value === undefined ? {} : { aspf: aspf.value }),
  };
  return Object.keys(expectation).length === 0 ? undefined : expectation;
}

async function runDns(command: Extract<Command, { kind: "dns" }>, options: RunMailCliOptions, output: CliOutput): Promise<number> {
  let domain = command.domain;
  let replyTo = command.replyTo;
  if (domain === undefined) {
    if (options.config === undefined) {
      output.error("softure-mail dns: pass --domain <domain>, or run it with the app's config to check the sender's domain");
      return EXIT_FAILED;
    }
    const mailing = getMailingOptions(options.config);
    domain = getSenderDomain(mailing.from);
    replyTo ??= mailing.replyTo;
  }
  const returnPath: ReturnPathHost[] = [...(command.resendReturnPath ? resendReturnPath(domain) : []), ...command.returnPathHosts.map((host) => ({ host }))];
  const report = await checkSenderDns(domain, {
    ...(command.dkimSelectors === undefined ? {} : { dkimSelectors: command.dkimSelectors }),
    ...(command.spfHosts === undefined ? {} : { spfHosts: command.spfHosts }),
    ...(command.expectDmarc === undefined ? {} : { expectDmarc: command.expectDmarc }),
    ...(replyTo === undefined ? {} : { replyTo }),
    returnPath,
    ...(options.resolveTxt === undefined ? {} : { resolveTxt: options.resolveTxt }),
    ...(options.resolveMx === undefined ? {} : { resolveMx: options.resolveMx }),
    ...(options.resolveCname === undefined ? {} : { resolveCname: options.resolveCname }),
  });
  const authentication: [string, DnsCheck][] = [
    ["SPF", report.spf],
    ["DKIM", report.dkim],
    ["DMARC", report.dmarc],
  ];
  const reply: [string, DnsCheck][] = report.replyTo === null ? [] : [["REPLY", report.replyTo]];
  const paths: [string, DnsCheck][] = report.returnPath.map((check) => ["PATH", check]);
  output.log(`sender domain ${report.domain}`);
  for (const [name, check] of [...authentication, ...reply, ...paths]) {
    const line = `${name.padEnd(6)}${check.status.padEnd(6)}${`${check.finding} `.padEnd(15)}${check.host}${check.record === null ? "" : `  ${check.record}`}`;
    if (check.status === "fail") output.error(line);
    else output.log(line);
  }
  const countFailed = (checks: readonly [string, DnsCheck][]) => checks.filter(([, check]) => check.status === "fail").length;
  const failedAuthentication = countFailed(authentication);
  const failedReply = countFailed(reply);
  const failedPaths = countFailed(paths);
  if (failedAuthentication + failedReply + failedPaths === 0) {
    output.log("receivers can authenticate mail from this domain");
    return EXIT_OK;
  }
  if (failedAuthentication > 0) output.log(`${String(failedAuthentication)} check(s) failed: list mail from this domain will land in spam or be refused`);
  if (failedReply > 0) output.log("the reply-to domain does not accept mail: replies will bounce");
  if (failedPaths > 0) output.log(`${String(failedPaths)} return-path host(s) failed: the provider cannot use them for bounces`);
  return EXIT_FAILED;
}

async function runCampaign(command: Extract<Command, { kind: "campaign" }>, options: RunMailCliOptions, output: CliOutput): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const config = options.config;
  if (config === undefined) {
    output.error("softure-mail campaign: needs the app's config");
    return EXIT_FAILED;
  }
  const loaded = await loadCampaign(resolve(cwd, command.contentFile), resolve(cwd, command.recipientsFile));
  if (typeof loaded === "string") {
    output.error(`softure-mail campaign: ${loaded}`);
    return EXIT_FAILED;
  }
  if (!command.dryRun && readUnsubscribeSecrets(options.env ?? process.env).current === null) {
    output.error(`softure-mail campaign: campaigns are list mail; set ${UNSUBSCRIBE_SECRET_ENV} (at least ${String(MIN_UNSUBSCRIBE_SECRET_LENGTH)} characters) to sign their unsubscribe links`);
    return EXIT_FAILED;
  }
  if (config.database === null) {
    output.error("softure-mail campaign: the config has no database; set database.url in softure.config");
    return EXIT_FAILED;
  }

  let opened: CommandDatabase;
  try {
    opened = await openDatabase(config.database, options.openDatabase);
  } catch (error) {
    output.error(`softure-mail campaign: ${describeError(error)}`);
    return EXIT_FAILED;
  }
  const ctx: DeliveryContext = { db: opened.handle.db, clock: systemClock, config };
  try {
    return command.dryRun
      ? await reportPlan(ctx, loaded, command.resendUncertain, output)
      : await reportSend(ctx, loaded, { pauseMs: command.pauseMs, sleep: options.sleep, retakeUncertain: command.resendUncertain }, output);
  } catch (error) {
    // Driver errors: the message only, never a stack, an address or the database URL.
    output.error(`softure-mail campaign: ${describeError(error)} (did softure migrate run?)`);
    return EXIT_FAILED;
  } finally {
    await opened.close();
  }
}

interface LoadedCampaign {
  readonly campaign: CampaignContent;
  readonly recipients: readonly string[];
}

async function loadCampaign(contentPath: string, recipientsPath: string): Promise<LoadedCampaign | string> {
  const source = await readText(contentPath);
  if (source === null) return `cannot read the content file ${contentPath}`;
  const parsed = parseCampaignFile(source);
  if (!parsed.ok) return `${contentPath} is not a campaign:\n  ${parsed.problems.join("\n  ")}`;
  const { htmlPath, ...content } = parsed.value;
  let html: string | null = null;
  if (htmlPath !== null) {
    const htmlFile = resolve(dirname(contentPath), htmlPath);
    html = await readText(htmlFile);
    if (html === null) return `cannot read the HTML body ${htmlFile}`;
    if (html.trim() === "") return `the HTML body ${htmlFile} is empty`;
  }
  const list = await readText(recipientsPath);
  if (list === null) return `cannot read the recipients file ${recipientsPath}`;
  return { campaign: { ...content, html }, recipients: parseRecipientList(list) };
}

async function reportPlan(ctx: DeliveryContext, loaded: LoadedCampaign, retakeUncertain: boolean, output: CliOutput): Promise<number> {
  const plan = await planCampaign(ctx, loaded, { retakeUncertain });
  output.log(`campaign ${loaded.campaign.id} (${loaded.campaign.kind}), dry run: nothing sent or written`);
  output.log(
    [
      `recipients ${String(plan.recipients)}`,
      `already done ${String(plan.done)}`,
      `unsubscribed ${String(plan.suppressed)}`,
      `filtered out ${String(plan.filtered)}`,
      `uncertain ${String(plan.uncertain)}`,
      `to send ${String(plan.toSend)}`,
    ].join(", "),
  );
  if (plan.contentChanged) {
    output.error(`campaign ${loaded.campaign.id} was sent with other content; give this content a new id`);
    return EXIT_FAILED;
  }
  return EXIT_OK;
}

async function reportSend(
  ctx: DeliveryContext,
  loaded: LoadedCampaign,
  pace: { readonly pauseMs: number; readonly sleep: ((ms: number) => Promise<void>) | undefined; readonly retakeUncertain: boolean },
  output: CliOutput,
): Promise<number> {
  let handled = 0;
  const total = loaded.recipients.length;
  const result = await sendCampaign(ctx, loaded, {
    pauseMs: pace.pauseMs,
    retakeUncertain: pace.retakeUncertain,
    ...(pace.sleep === undefined ? {} : { sleep: pace.sleep }),
    onDelivery: () => {
      handled += 1;
      if (handled % 100 === 0) output.log(`progress ${String(handled)}/${String(total)}`);
    },
  });
  if (!result.ok) {
    output.error(`campaign ${loaded.campaign.id} was sent with other content; give this content a new id`);
    return EXIT_FAILED;
  }
  const summary = result.value;
  output.log(`campaign ${loaded.campaign.id} (${loaded.campaign.kind}): ${formatSummary(summary)}`);
  let code = EXIT_OK;
  if (summary.halted !== null) {
    const status = summary.halted.httpStatus === undefined ? "" : ` (HTTP ${String(summary.halted.httpStatus)})`;
    output.error(`stopped: ${HALT_EXPLANATIONS[summary.halted.reason]}${status}; the remaining recipients were not touched, run the same command again once it is fixed`);
    code = EXIT_FAILED;
  }
  const open = summary.inFlight + summary.retryLater;
  if (open > 0 && summary.halted === null) {
    output.error(`${String(open)} recipient(s) have no outcome yet; run the same command again later`);
    code = EXIT_FAILED;
  }
  if (summary.uncertain > 0) {
    output.error(
      `${String(summary.uncertain)} recipient(s) are uncertain: a send was interrupted long ago and may have gone out; check the provider's log, then run again with --resend-uncertain to send them anyway`,
    );
    code = EXIT_FAILED;
  }
  return code;
}

const HALT_EXPLANATIONS: Readonly<Record<HaltingErrorCode, string>> = {
  "mailing.provider_refused": "the provider refused the account (check the API key and the account)",
  "mailing.quota_exceeded": "the account's sending quota is spent",
};

function formatSummary(summary: CampaignSummary): string {
  const rejected = Object.entries(summary.rejected).filter(([, count]) => count > 0);
  const rejectedTotal = rejected.reduce((sum, [, count]) => sum + count, 0);
  const reasons = rejected.length === 0 ? "" : ` (${rejected.map(([code, count]) => `${code.slice("mailing.".length)} ${String(count)}`).join(", ")})`;
  return [
    `recipients ${String(summary.recipients)}`,
    `sent ${String(summary.sent)}`,
    `rejected ${String(rejectedTotal)}${reasons}`,
    `already done ${String(summary.done)}`,
    `in flight ${String(summary.inFlight)}`,
    `retry later ${String(summary.retryLater)}`,
    `filtered out ${String(summary.filtered)}`,
    `uncertain ${String(summary.uncertain)}`,
  ].join(", ");
}

async function openDatabase(database: SoftureDatabaseConfig, open: ((url: string) => Promise<DatabaseHandle>) | undefined): Promise<CommandDatabase> {
  if (open === undefined) return openCommandDatabase(database, { max: 1 });
  const handle = await open(database.url);
  return { handle, close: handle.close };
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    // The caller names the path; the error code adds nothing an operator can act on.
    return null;
  }
}

/**
 * The driver's own message. Drizzle wraps it in "Failed query: <sql> params: <values>", and the
 * values hold recipient keys, so the wrapper is dropped.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error ? error.cause.message : error.message;
}
