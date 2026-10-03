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
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { createDatabase, type DatabaseHandle } from "@softure-ai/db";
import { parseCampaignFile, parseRecipientList, type CampaignContent } from "../server/campaign-file.js";
import { planCampaign, sendCampaign, type CampaignSummary } from "../server/campaigns.js";
import type { DeliveryContext } from "../server/deliveries.js";
import { checkSenderDns, getSenderDomain, type DnsCheck, type ResolveTxt } from "../server/dns.js";
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
  /** Opens the campaign's database connection. Default: `createDatabase(url, { max: 1 })`. */
  readonly openDatabase?: (url: string) => Promise<DatabaseHandle>;
  readonly resolveTxt?: ResolveTxt;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly env?: Env;
}

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

/** Pause between sends: Resend's default limit is two requests per second. */
export const DEFAULT_PAUSE_MS = 500;

export const MAIL_USAGE = `Usage:
  softure-mail campaign <content-file> --recipients <file> [--dry-run] [--pause-ms <ms>]
  softure-mail dns [--domain <domain>] [--dkim-selector <name>]... [--spf-host <host>]...

campaign  Sends the campaign in <content-file> (frontmatter id, kind, subject, optional html,
          then the text body) to every address in the recipients file (one per line), at most
          once each. Re-running sends only to recipients without an outcome yet.
  --dry-run          count what would be sent and change nothing
  --pause-ms <ms>    pause after every send (default ${String(DEFAULT_PAUSE_MS)})

dns       Checks SPF, DKIM and DMARC for the sender domain (default: the domain of "from").
  --domain <domain>       check this domain instead
  --dkim-selector <name>  DKIM selector to look up (default resend; repeatable)
  --spf-host <host>       where SPF is published (default the domain; repeatable;
                          Resend publishes it on send.<domain>)

Options for both:
  --config <file>    the app's softure.config file (bin only)
  --help             show this help`;

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

type Command =
  | { readonly kind: "help" }
  | { readonly kind: "campaign"; readonly contentFile: string; readonly recipientsFile: string; readonly dryRun: boolean; readonly pauseMs: number }
  | { readonly kind: "dns"; readonly domain: string | undefined; readonly dkimSelectors: readonly string[] | undefined; readonly spfHosts: readonly string[] | undefined };

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
    const misplaced = (["recipients", "dry-run", "pause-ms"] as const).filter((option) => values[option] !== undefined);
    if (misplaced.length > 0) return `dns does not take --${misplaced.join(", --")}`;
    if (positionals.length > 0) return `dns takes no file, got "${positionals.join(" ")}"`;
    return { kind: "dns", domain: values.domain, dkimSelectors: values["dkim-selector"], spfHosts: values["spf-host"] };
  }

  const misplaced = (["domain", "dkim-selector", "spf-host"] as const).filter((option) => values[option] !== undefined);
  if (misplaced.length > 0) return `campaign does not take --${misplaced.join(", --")}`;
  const [contentFile, ...extra] = positionals;
  if (contentFile === undefined) return "campaign needs a content file";
  if (extra.length > 0) return `campaign takes one content file, got also "${extra.join(" ")}"`;
  if (values.recipients === undefined) return "campaign needs --recipients <file>";
  const pauseMs = values["pause-ms"] === undefined ? DEFAULT_PAUSE_MS : Number(values["pause-ms"]);
  if (!Number.isInteger(pauseMs) || pauseMs < 0 || pauseMs > 60_000) return `--pause-ms expects whole milliseconds from 0 to 60000, got "${values["pause-ms"] ?? ""}"`;
  return { kind: "campaign", contentFile, recipientsFile: values.recipients, dryRun: values["dry-run"] === true, pauseMs };
}

function parseCommandArgs(args: readonly string[]) {
  return parseArgs({
    args: [...args],
    options: {
      recipients: { type: "string" },
      "dry-run": { type: "boolean" },
      "pause-ms": { type: "string" },
      domain: { type: "string" },
      "dkim-selector": { type: "string", multiple: true },
      "spf-host": { type: "string", multiple: true },
      help: { type: "boolean" },
    },
    strict: true,
    allowPositionals: true,
  });
}

async function runDns(command: Extract<Command, { kind: "dns" }>, options: RunMailCliOptions, output: CliOutput): Promise<number> {
  let domain = command.domain;
  if (domain === undefined) {
    if (options.config === undefined) {
      output.error("softure-mail dns: pass --domain <domain>, or run it with the app's config to check the sender's domain");
      return EXIT_FAILED;
    }
    domain = getSenderDomain(getMailingOptions(options.config).from);
  }
  const report = await checkSenderDns(domain, {
    ...(command.dkimSelectors === undefined ? {} : { dkimSelectors: command.dkimSelectors }),
    ...(command.spfHosts === undefined ? {} : { spfHosts: command.spfHosts }),
    ...(options.resolveTxt === undefined ? {} : { resolveTxt: options.resolveTxt }),
  });
  const checks: [string, DnsCheck][] = [
    ["SPF", report.spf],
    ["DKIM", report.dkim],
    ["DMARC", report.dmarc],
  ];
  output.log(`sender domain ${report.domain}`);
  for (const [name, check] of checks) {
    const line = `${name.padEnd(6)}${check.status.padEnd(6)}${check.finding.padEnd(15)}${check.host}${check.record === null ? "" : `  ${check.record}`}`;
    if (check.status === "fail") output.error(line);
    else output.log(line);
  }
  const failed = checks.filter(([, check]) => check.status === "fail").length;
  output.log(failed === 0 ? "receivers can authenticate mail from this domain" : `${String(failed)} check(s) failed: list mail from this domain will land in spam or be refused`);
  return failed === 0 ? EXIT_OK : EXIT_FAILED;
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

  let handle: DatabaseHandle;
  try {
    handle = await (options.openDatabase ?? openDatabase)(config.database.url);
  } catch (error) {
    output.error(`softure-mail campaign: ${describeError(error)}`);
    return EXIT_FAILED;
  }
  const ctx: DeliveryContext = { db: handle.db, clock: systemClock, config };
  try {
    return command.dryRun ? await reportPlan(ctx, loaded, output) : await reportSend(ctx, loaded, { pauseMs: command.pauseMs, sleep: options.sleep }, output);
  } catch (error) {
    // Driver errors: the message only, never a stack, an address or the database URL.
    output.error(`softure-mail campaign: ${describeError(error)} (did softure migrate run?)`);
    return EXIT_FAILED;
  } finally {
    await handle.close();
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

async function reportPlan(ctx: DeliveryContext, loaded: LoadedCampaign, output: CliOutput): Promise<number> {
  const plan = await planCampaign(ctx, loaded);
  output.log(`campaign ${loaded.campaign.id} (${loaded.campaign.kind}), dry run: nothing sent or written`);
  output.log(`recipients ${String(plan.recipients)}, already done ${String(plan.done)}, unsubscribed ${String(plan.suppressed)}, to send ${String(plan.toSend)}`);
  if (plan.contentChanged) {
    output.error(`campaign ${loaded.campaign.id} was sent with other content; give this content a new id`);
    return EXIT_FAILED;
  }
  return EXIT_OK;
}

async function reportSend(
  ctx: DeliveryContext,
  loaded: LoadedCampaign,
  pace: { readonly pauseMs: number; readonly sleep: ((ms: number) => Promise<void>) | undefined },
  output: CliOutput,
): Promise<number> {
  let handled = 0;
  const total = loaded.recipients.length;
  const result = await sendCampaign(ctx, loaded, {
    pauseMs: pace.pauseMs,
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
  output.log(`campaign ${loaded.campaign.id} (${loaded.campaign.kind}): ${formatSummary(result.value)}`);
  const open = result.value.inFlight + result.value.retryLater;
  if (open > 0) {
    output.error(`${String(open)} recipient(s) have no outcome yet; run the same command again later`);
    return EXIT_FAILED;
  }
  return EXIT_OK;
}

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
  ].join(", ");
}

function openDatabase(url: string): Promise<DatabaseHandle> {
  return createDatabase(url, { max: 1 });
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
