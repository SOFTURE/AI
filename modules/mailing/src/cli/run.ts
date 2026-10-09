// `softure-mail`: sends a campaign from a content file, sends a test mail to the configured test
// address, imports an app's delivery history into the ledger and checks the sender domain's DNS. The app passes its validated config, so the same
// function serves the bin and an app script that a bundler packs for a container:
//
//   // scripts/mail.ts
//   import { runMailCli } from "@softure-ai/mailing/cli";
//   import config from "../softure.config";
//   process.exitCode = await runMailCli({ config, argv: process.argv.slice(2) });
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { systemClock, type SoftureConfig, type SoftureDatabaseConfig } from "@softure-ai/core";
import { z } from "zod";
import { openCommandDatabase, type CommandDatabase, type DatabaseHandle } from "@softure-ai/db";
import { TRANSACTIONAL_KIND, type OutgoingMail, type ProviderMessage } from "../contract.js";
import { getCampaignProblems, parseCampaignFile, parseRecipientList, type CampaignContent } from "../server/campaign-file.js";
import { listConfiguredCampaignRecipients, planCampaign, sendCampaign, type CampaignSummary } from "../server/campaigns.js";
import type { DeliveryContext, HaltingErrorCode } from "../server/deliveries.js";
import { checkSenderDns, getSenderDomain, resendReturnPath, type DmarcAlignment, type DmarcExpectation, type DmarcPolicy, type DnsCheck, type ResolveCname, type ResolveMx, type ResolveTxt, type ReturnPathHost } from "../server/dns.js";
import { checkImportedDeliveries, importDeliveries, type ImportedDelivery, type ImportProblem } from "../server/import-deliveries.js";
import { maskAddress, redactUnsubscribeSignatures } from "../server/operator-output.js";
import { getMailingOptions, resolveMailKind } from "../server/options.js";
import { previewMail, sendMail } from "../server/send-mail.js";
import { MIN_UNSUBSCRIBE_SECRET_LENGTH, readUnsubscribeSecrets, UNSUBSCRIBE_SECRET_ENV, type Env } from "../server/unsubscribe-link.js";

export interface CliOutput {
  readonly log: (line: string) => void;
  readonly error: (line: string) => void;
}

export interface RunMailCliOptions {
  /** The app's config. Needed by `campaign`, `test` and `import`, and by `dns` without `--domain`. */
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
  /** Reads all of standard input, for a file given as `-`. Default: `process.stdin`. */
  readonly readStdin?: () => Promise<string>;
}

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

/** Pause between sends: Resend's default limit is two requests per second. */
export const DEFAULT_PAUSE_MS = 500;

export const MAIL_USAGE = `Usage:
  softure-mail campaign <content-file> [--recipients <file>] [--dry-run] [--pause-ms <ms>] [--resend-uncertain]
                        [--limit <n>]
  softure-mail test [<content-file>] [--kind <kind>] [--preview]
  softure-mail import <history-file> [--dry-run]
  softure-mail dns [--domain <domain>] [--dkim-selector <name>]... [--spf-host <host>]...
                   [--dmarc-policy <p>] [--dmarc-sp <p>] [--dmarc-adkim <a>] [--dmarc-aspf <a>]
                   [--reply-to <address>] [--return-path <host>]... [--resend-return-path]
                   [--inbound cloudflare]

campaign  Sends the campaign in <content-file> (frontmatter id, kind, subject, optional html,
          then the text body) to every address in the recipients file (one per line), at most
          once each. Without --recipients, the recipients come from listCampaignRecipients in
          the mailing options. Re-running sends only to recipients without an outcome yet. A
          refused API key or a spent quota stops the run; the rest go out on the next one.
  --recipients <file>  the recipients, one address per line
  --dry-run            count what would be sent and change nothing
  --pause-ms <ms>      pause after every send (default ${String(DEFAULT_PAUSE_MS)})
  --resend-uncertain   also send to recipients whose send was interrupted long ago
                       (it may have gone out: they may get the mail twice)
  --limit <n>          hand at most n mails to the provider in this run (1 to 1000000);
                       the rest waits for the next run
  --content-file <file>  the content file, instead of naming it first (for softure-deploy run)
  The kind may be an alias of kindAliases in the mailing options. A dry run also prints the
  mail as the test address (testAddress in the mailing options) would get it. Content that
  carries an unsubscribe link or footer pasted from a sent mail is refused.

test      Sends one mail to testAddress of the mailing options, and to no one else: the
          campaign in <content-file> (without the ledger: it can be sent again), or a short
          fixed test mail.
  --kind <kind>        the mail's kind (default: the file's, else transactional); list kinds
                       get the unsubscribe footer and headers
  --preview            print the mail instead of sending it

import    Writes deliveries the app made before it adopted the module into the ledger, so
          later sends skip them. <history-file> holds one JSON object per line: scope,
          address, status (sent or rejected), finishedAt, and optional providerMessageId,
          reason, kind. Rows already in the ledger are left as they are; any invalid row
          stops the import before anything is written.
  --dry-run            check the file and change nothing

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
  --inbound cloudflare    check that Cloudflare Email Routing receives the reply-to domain's
                          mail (its MX and one SPF record that includes it)

Options for all:
  --config <file>    the app's softure.config file (bin only)
  --help             show this help

A file given as - is read from standard input (one of them per command), e.g.
  docker compose exec -T app npx softure-mail campaign - < launch.md
Addresses in the output are masked and unsubscribe links lose their signature.`;

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

type Command =
  | { readonly kind: "help" }
  | {
      readonly kind: "campaign";
      readonly contentFile: string;
      /** `null`: the module's `listCampaignRecipients`. */
      readonly recipientsFile: string | null;
      readonly dryRun: boolean;
      readonly pauseMs: number;
      readonly resendUncertain: boolean;
      /** `null`: no limit. */
      readonly limit: number | null;
    }
  | {
      readonly kind: "test";
      /** `null`: the fixed test mail. */
      readonly contentFile: string | null;
      /** `null`: the file's kind, else transactional. */
      readonly mailKind: string | null;
      readonly preview: boolean;
    }
  | { readonly kind: "import"; readonly historyFile: string; readonly dryRun: boolean }
  | {
      readonly kind: "dns";
      readonly domain: string | undefined;
      readonly dkimSelectors: readonly string[] | undefined;
      readonly spfHosts: readonly string[] | undefined;
      readonly expectDmarc: DmarcExpectation | undefined;
      readonly replyTo: string | undefined;
      readonly returnPathHosts: readonly string[];
      readonly resendReturnPath: boolean;
      readonly inbound: "cloudflare" | undefined;
    };

const DMARC_POLICIES: readonly DmarcPolicy[] = ["quarantine", "reject"];
const DMARC_ALIGNMENTS: readonly DmarcAlignment[] = ["r", "s"];
/** A file name that means standard input. */
const STDIN = "-";
const CAMPAIGN_ONLY_OPTIONS = ["recipients", "pause-ms", "resend-uncertain", "limit"] as const;
const TEST_ONLY_OPTIONS = ["kind", "preview"] as const;
const MAX_LIMIT = 1_000_000;
const DNS_ONLY_OPTIONS = ["domain", "dkim-selector", "spf-host", "dmarc-policy", "dmarc-sp", "dmarc-adkim", "dmarc-aspf", "reply-to", "return-path", "resend-return-path", "inbound"] as const;
const COMMANDS = ["campaign", "test", "import", "dns"] as const;

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
    case "test":
      return runTest(command, options, output);
    case "import":
      return runImport(command, options, output);
  }
}

function parseCommand(argv: readonly string[]): Command | string {
  const [name, ...rest] = argv;
  if (name === undefined) return "missing command; use campaign, test, import or dns";
  if (name === "--help") return { kind: "help" };
  if (!(COMMANDS as readonly string[]).includes(name)) return `unknown command "${name}"; use campaign, test, import or dns`;

  let parsed: ReturnType<typeof parseCommandArgs>;
  try {
    parsed = parseCommandArgs(rest);
  } catch (error) {
    return describeError(error);
  }
  const { values, positionals } = parsed;
  if (values.help === true) return { kind: "help" };

  if (name === "dns") {
    const misplaced = ([...CAMPAIGN_ONLY_OPTIONS, ...TEST_ONLY_OPTIONS, "content-file", "dry-run"] as const).filter((option) => values[option] !== undefined);
    if (misplaced.length > 0) return `dns does not take --${misplaced.join(", --")}`;
    if (positionals.length > 0) return `dns takes no file, got "${positionals.join(" ")}"`;
    const expectDmarc = parseDmarcExpectation(values);
    if (typeof expectDmarc === "string") return expectDmarc;
    const inbound = values.inbound?.trim().toLowerCase();
    if (inbound !== undefined && inbound !== "cloudflare") return `--inbound expects cloudflare, got "${values.inbound ?? ""}"`;
    return {
      kind: "dns",
      domain: values.domain,
      dkimSelectors: values["dkim-selector"],
      spfHosts: values["spf-host"],
      expectDmarc,
      replyTo: values["reply-to"],
      returnPathHosts: values["return-path"] ?? [],
      resendReturnPath: values["resend-return-path"] === true,
      inbound,
    };
  }

  if (name === "import") {
    const misplaced = [...CAMPAIGN_ONLY_OPTIONS, ...TEST_ONLY_OPTIONS, ...DNS_ONLY_OPTIONS, "content-file" as const].filter((option) => values[option] !== undefined);
    if (misplaced.length > 0) return `import does not take --${misplaced.join(", --")}`;
    const [historyFile, ...extra] = positionals;
    if (historyFile === undefined) return "import needs a history file (- for standard input)";
    if (extra.length > 0) return `import takes one history file, got also "${extra.join(" ")}"`;
    return { kind: "import", historyFile, dryRun: values["dry-run"] === true };
  }

  const content = pickContentFile(name, positionals, values["content-file"]);
  if (typeof content !== "object") return content;
  if (name === "test") {
    const misplaced = ([...CAMPAIGN_ONLY_OPTIONS, ...DNS_ONLY_OPTIONS, "dry-run"] as const).filter((option) => values[option] !== undefined);
    if (misplaced.length > 0) return `test does not take --${misplaced.join(", --")}`;
    return { kind: "test", contentFile: content.file, mailKind: values.kind ?? null, preview: values.preview === true };
  }

  const misplaced = [...TEST_ONLY_OPTIONS, ...DNS_ONLY_OPTIONS].filter((option) => values[option] !== undefined);
  if (misplaced.length > 0) return `campaign does not take --${misplaced.join(", --")}`;
  const contentFile = content.file;
  if (contentFile === null) return "campaign needs a content file";
  if (contentFile === STDIN && values.recipients === STDIN) return "campaign can read only one of the content file and --recipients from standard input";
  const pauseMs = values["pause-ms"] === undefined ? DEFAULT_PAUSE_MS : Number(values["pause-ms"]);
  if (!Number.isInteger(pauseMs) || pauseMs < 0 || pauseMs > 60_000) return `--pause-ms expects whole milliseconds from 0 to 60000, got "${values["pause-ms"] ?? ""}"`;
  const limit = values.limit === undefined ? null : Number(values.limit);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT)) return `--limit expects a whole number from 1 to ${String(MAX_LIMIT)}, got "${values.limit ?? ""}"`;
  return {
    kind: "campaign",
    contentFile,
    recipientsFile: values.recipients ?? null,
    dryRun: values["dry-run"] === true,
    pauseMs,
    resendUncertain: values["resend-uncertain"] === true,
    limit,
  };
}

function parseCommandArgs(args: readonly string[]) {
  return parseArgs({
    args: [...args],
    options: {
      recipients: { type: "string" },
      "dry-run": { type: "boolean" },
      "pause-ms": { type: "string" },
      "resend-uncertain": { type: "boolean" },
      limit: { type: "string" },
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
      inbound: { type: "string" },
      "content-file": { type: "string" },
      kind: { type: "string" },
      preview: { type: "boolean" },
      help: { type: "boolean" },
    },
    strict: true,
    allowPositionals: true,
  });
}

type ParsedValues = ReturnType<typeof parseCommandArgs>["values"];

/** The content file, named first or with `--content-file` (not both, at most one); `null` when none was given. */
function pickContentFile(command: string, positionals: readonly string[], option: string | undefined): { readonly file: string | null } | string {
  const [first, ...extra] = positionals;
  if (extra.length > 0) return `${command} takes one content file, got also "${extra.join(" ")}"`;
  if (first !== undefined && option !== undefined) return `${command} takes the content file once: name it first or with --content-file`;
  return { file: first ?? option ?? null };
}

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
    ...(command.inbound === undefined ? {} : { inbound: command.inbound }),
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
  const inbound: [string, DnsCheck][] = report.inbound.map((check) => ["INBOUND", check]);
  output.log(`sender domain ${report.domain}`);
  for (const [name, check] of [...authentication, ...reply, ...paths, ...inbound]) {
    const line = `${name.padEnd(name.length >= 6 ? name.length + 1 : 6)}${check.status.padEnd(6)}${`${check.finding} `.padEnd(15)}${check.host}${check.record === null ? "" : `  ${check.record}`}`;
    if (check.status === "fail") output.error(line);
    else output.log(line);
  }
  const countFailed = (checks: readonly [string, DnsCheck][]) => checks.filter(([, check]) => check.status === "fail").length;
  const failedAuthentication = countFailed(authentication);
  const failedReply = countFailed(reply);
  const failedPaths = countFailed(paths);
  const failedInbound = countFailed(inbound);
  if (failedAuthentication + failedReply + failedPaths + failedInbound === 0) {
    output.log("receivers can authenticate mail from this domain");
    return EXIT_OK;
  }
  if (failedAuthentication > 0) output.log(`${String(failedAuthentication)} check(s) failed: list mail from this domain will land in spam or be refused`);
  if (failedReply > 0) output.log("the reply-to domain does not accept mail: replies will bounce");
  if (failedPaths > 0) output.log(`${String(failedPaths)} return-path host(s) failed: the provider cannot use them for bounces`);
  if (failedInbound > 0) output.log("the inbound service does not receive this domain's mail: replies will not reach it");
  return EXIT_FAILED;
}

async function runCampaign(command: Extract<Command, { kind: "campaign" }>, options: RunMailCliOptions, output: CliOutput): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const config = options.config;
  if (config === undefined) {
    output.error("softure-mail campaign: needs the app's config");
    return EXIT_FAILED;
  }
  const input = createInputReader(cwd, options.readStdin ?? readProcessStdin);
  const content = await loadCampaignContent(command.contentFile, input, config);
  if (typeof content === "string") {
    output.error(`softure-mail campaign: ${content}`);
    return EXIT_FAILED;
  }
  const listed = command.recipientsFile === null ? null : await loadRecipientFile(command.recipientsFile, input);
  if (typeof listed === "string") {
    output.error(`softure-mail campaign: ${listed}`);
    return EXIT_FAILED;
  }
  if (listed === null && getMailingOptions(config).listCampaignRecipients === undefined) {
    output.error("softure-mail campaign: pass --recipients <file>, or set listCampaignRecipients in the mailing options");
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
    const loaded: LoadedCampaign = { campaign: content, recipients: listed ?? (await collectRecipients(ctx, content)) };
    return command.dryRun
      ? await reportPlan(ctx, loaded, { retakeUncertain: command.resendUncertain, limit: command.limit, env: options.env ?? process.env }, output)
      : await reportSend(ctx, loaded, { pauseMs: command.pauseMs, sleep: options.sleep, retakeUncertain: command.resendUncertain, limit: command.limit }, output);
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

/** Reads a named file, or standard input for `-`; `name` is what messages call it. */
interface InputReader {
  readonly read: (file: string) => Promise<{ readonly text: string | null; readonly name: string; readonly dir: string }>;
}

function createInputReader(cwd: string, readStdin: () => Promise<string>): InputReader {
  return {
    read: async (file) => {
      if (file === STDIN) return { text: await readStdin(), name: "standard input", dir: cwd };
      const path = resolve(cwd, file);
      return { text: await readText(path), name: path, dir: dirname(path) };
    },
  };
}

/**
 * The campaign in `file`, its kind resolved through `kindAliases`, checked for pasted unsubscribe links and footers;
 * a string says what is wrong.
 */
async function loadCampaignContent(file: string, input: InputReader, config: SoftureConfig): Promise<CampaignContent | string> {
  const source = await input.read(file);
  if (source.text === null) return `cannot read the content file ${source.name}`;
  const parsed = parseCampaignFile(source.text);
  if (!parsed.ok) return `${source.name} is not a campaign:\n  ${parsed.problems.join("\n  ")}`;
  const { htmlPath, kind, ...content } = parsed.value;
  let html: string | null = null;
  if (htmlPath !== null) {
    // Next to the content file; for standard input, the working directory.
    const htmlFile = resolve(source.dir, htmlPath);
    html = await readText(htmlFile);
    if (html === null) return `cannot read the HTML body ${htmlFile}`;
    if (html.trim() === "") return `the HTML body ${htmlFile} is empty`;
  }
  const campaign: CampaignContent = { ...content, kind: resolveMailKind(config, kind), html };
  const problems = getCampaignProblems(campaign, config);
  return problems.length === 0 ? campaign : `${source.name} cannot be sent:\n  ${problems.join("\n  ")}`;
}

async function loadRecipientFile(file: string, input: InputReader): Promise<readonly string[] | string> {
  const list = await input.read(file);
  if (list.text === null) return `cannot read the recipients file ${list.name}`;
  return parseRecipientList(list.text);
}

/** The recipients from `listCampaignRecipients`, which the caller checked is set. */
async function collectRecipients(ctx: DeliveryContext, campaign: CampaignContent): Promise<readonly string[]> {
  const recipients: string[] = [];
  const source = await listConfiguredCampaignRecipients(ctx, campaign);
  if (source === null) return recipients;
  for await (const address of source) recipients.push(address);
  return recipients;
}

/** One line of a history file. Unknown keys are refused, so a typo does not drop a field. */
const historyRowSchema = z.strictObject({
  scope: z.string(),
  address: z.string(),
  status: z.enum(["sent", "rejected"]),
  finishedAt: z.string(),
  providerMessageId: z.string().optional(),
  reason: z.enum(["mailing.invalid_input", "mailing.rejected", "mailing.unavailable", "mailing.suppressed"]).optional(),
  kind: z.string().optional(),
});

async function runImport(command: Extract<Command, { kind: "import" }>, options: RunMailCliOptions, output: CliOutput): Promise<number> {
  const config = options.config;
  if (config === undefined) {
    output.error("softure-mail import: needs the app's config");
    return EXIT_FAILED;
  }
  const source = await createInputReader(options.cwd ?? process.cwd(), options.readStdin ?? readProcessStdin).read(command.historyFile);
  if (source.text === null) {
    output.error(`softure-mail import: cannot read the history file ${source.name}`);
    return EXIT_FAILED;
  }
  const parsed = parseHistory(source.text);
  if (parsed.problems.length > 0) return reportImportProblems(parsed.problems, output);
  const rows = parsed.rows.map((row) => row.delivery);
  const lineOf = (problem: ImportProblem) => parsed.rows[problem.index]?.line ?? 0;

  // Checked before the database is opened, so a bad file costs no connection.
  const checked = checkImportedDeliveries({ clock: systemClock }, rows);
  if (!checked.ok) return reportImportProblems(checked.problems.map((problem) => ({ line: lineOf(problem), problem: problem.problem })), output);
  if (command.dryRun) {
    output.log(`import, dry run: nothing written; rows ${String(rows.length)}, duplicates ${String(checked.value.duplicates)}`);
    return EXIT_OK;
  }
  if (config.database === null) {
    output.error("softure-mail import: the config has no database; set database.url in softure.config");
    return EXIT_FAILED;
  }
  let opened: CommandDatabase;
  try {
    opened = await openDatabase(config.database, options.openDatabase);
  } catch (error) {
    output.error(`softure-mail import: ${describeError(error)}`);
    return EXIT_FAILED;
  }
  try {
    const result = await importDeliveries({ db: opened.handle.db, clock: systemClock, config }, rows);
    if (!result.ok) return reportImportProblems(result.problems.map((problem) => ({ line: lineOf(problem), problem: problem.problem })), output);
    const summary = result.value;
    output.log(`import: rows ${String(summary.rows)}, imported ${String(summary.imported)}, already present ${String(summary.alreadyPresent)}, duplicates ${String(summary.duplicates)}`);
    return EXIT_OK;
  } catch (error) {
    output.error(`softure-mail import: ${describeError(error)} (did softure migrate run?)`);
    return EXIT_FAILED;
  } finally {
    await opened.close();
  }
}

interface LineProblem {
  readonly line: number;
  readonly problem: string;
}

/** The history file's rows with their line numbers; problems name lines and fields, never values. */
function parseHistory(text: string): { readonly rows: readonly { readonly line: number; readonly delivery: ImportedDelivery }[]; readonly problems: readonly LineProblem[] } {
  const rows: { line: number; delivery: ImportedDelivery }[] = [];
  const problems: LineProblem[] = [];
  text.split(/\r?\n/).forEach((source, index) => {
    const line = index + 1;
    if (source.trim() === "") return;
    let value: unknown;
    try {
      value = JSON.parse(source);
    } catch {
      problems.push({ line, problem: "not a JSON object" });
      return;
    }
    const parsed = historyRowSchema.safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path.length === 0 ? "row" : issue.path.join(".");
        problems.push({ line, problem: issue.code === "unrecognized_keys" ? `unknown field(s) ${issue.keys.join(", ")}` : `${field}: ${issue.message}` });
      }
      return;
    }
    const { providerMessageId, reason, kind, ...required } = parsed.data;
    rows.push({
      line,
      delivery: { ...required, ...(providerMessageId === undefined ? {} : { providerMessageId }), ...(reason === undefined ? {} : { reason }), ...(kind === undefined ? {} : { kind }) },
    });
  });
  return { rows, problems };
}

function reportImportProblems(problems: readonly LineProblem[], output: CliOutput): number {
  output.error(`softure-mail import: nothing written, ${String(problems.length)} problem(s):`);
  for (const { line, problem } of problems) output.error(`  line ${String(line)}: ${problem}`);
  return EXIT_FAILED;
}

async function reportPlan(
  ctx: DeliveryContext,
  loaded: LoadedCampaign,
  run: { readonly retakeUncertain: boolean; readonly limit: number | null; readonly env: Env },
  output: CliOutput,
): Promise<number> {
  const plan = await planCampaign(ctx, loaded, { retakeUncertain: run.retakeUncertain });
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
  if (run.limit !== null) output.log(`with --limit ${String(run.limit)} this run would send ${String(Math.min(plan.toSend, run.limit))}`);
  if (plan.contentChanged) {
    output.error(`campaign ${loaded.campaign.id} was sent with other content; give this content a new id`);
    return EXIT_FAILED;
  }
  const { campaign } = loaded;
  const to = getMailingOptions(ctx.config).testAddress ?? PREVIEW_ADDRESS;
  const preview = previewMail(ctx.config, { to, subject: campaign.subject, text: campaign.text, kind: campaign.kind, ...(campaign.html === null ? {} : { html: campaign.html }) }, { env: run.env });
  if (preview.ok) printPreview(preview.value, output);
  else if (preview.error === "mailing.unavailable") output.log(`no preview: set ${UNSUBSCRIBE_SECRET_ENV} to render the unsubscribe footer`);
  else output.log(`no preview: the mail is invalid (${preview.fields.join(", ")})`);
  return EXIT_OK;
}

/** Who a dry run's preview is addressed to without `testAddress`; `.example` never receives mail (RFC 2606). */
const PREVIEW_ADDRESS = "recipient@example.com";

/** The mail as the provider would get it, one output line per line, the address masked and signatures redacted. */
function printPreview(message: ProviderMessage, output: CliOutput): void {
  const headers = [
    `From: ${message.from}`,
    `To: ${maskAddress(message.to)}`,
    ...(message.replyTo === null ? [] : [`Reply-To: ${maskAddress(message.replyTo)}`]),
    `Subject: ${message.subject}`,
    ...Object.entries(message.headers).map(([name, value]) => `${name}: ${value}`),
  ];
  const sections = [`--- preview (addresses masked, link signatures redacted) ---`, ...headers, "", "--- text ---", message.text];
  if (message.html !== null) sections.push("--- html ---", message.html);
  sections.push("--- end of preview ---");
  for (const line of redactUnsubscribeSignatures(sections.join("\n")).split("\n")) output.log(line);
}

/** The fixed mail of `softure-mail test` without a content file. Operator text: the test address is the operator's. */
const TEST_MAIL = {
  subject: "softure-mail test",
  text: "This is a test mail from softure-mail. It arrived, so the provider, the sender address and the reply-to work.",
};

async function runTest(command: Extract<Command, { kind: "test" }>, options: RunMailCliOptions, output: CliOutput): Promise<number> {
  const config = options.config;
  if (config === undefined) {
    output.error("softure-mail test: needs the app's config");
    return EXIT_FAILED;
  }
  const testAddress = getMailingOptions(config).testAddress;
  if (testAddress === undefined) {
    output.error("softure-mail test: set testAddress in the mailing options; the test sends to that address only");
    return EXIT_FAILED;
  }
  let body: { readonly subject: string; readonly text: string; readonly html: string | null; readonly kind: string } = { ...TEST_MAIL, html: null, kind: TRANSACTIONAL_KIND };
  if (command.contentFile !== null) {
    const content = await loadCampaignContent(command.contentFile, createInputReader(options.cwd ?? process.cwd(), options.readStdin ?? readProcessStdin), config);
    if (typeof content === "string") {
      output.error(`softure-mail test: ${content}`);
      return EXIT_FAILED;
    }
    body = content;
  }
  const kind = command.mailKind === null ? body.kind : resolveMailKind(config, command.mailKind);
  const mail: OutgoingMail = { to: testAddress, subject: body.subject, text: body.text, kind, ...(body.html === null ? {} : { html: body.html }) };
  const masked = maskAddress(testAddress);
  if (command.preview) {
    const preview = previewMail(config, mail, { env: options.env ?? process.env });
    if (!preview.ok) {
      output.error(`softure-mail test: ${preview.error === "mailing.invalid_input" ? `the mail is invalid (${preview.fields.join(", ")})` : `set ${UNSUBSCRIBE_SECRET_ENV} to sign the unsubscribe link of list mail`}`);
      return EXIT_FAILED;
    }
    printPreview(preview.value, output);
    return EXIT_OK;
  }
  if (kind === TRANSACTIONAL_KIND) return reportTestSend(await sendMail({ config }, mail), { masked, kind }, output);
  if (config.database === null) {
    output.error("softure-mail test: list mail needs the database (its suppression list); set database.url in softure.config");
    return EXIT_FAILED;
  }
  let opened: CommandDatabase;
  try {
    opened = await openDatabase(config.database, options.openDatabase);
  } catch (error) {
    output.error(`softure-mail test: ${describeError(error)}`);
    return EXIT_FAILED;
  }
  try {
    return reportTestSend(await sendMail({ config, db: opened.handle.db }, mail), { masked, kind }, output);
  } finally {
    await opened.close();
  }
}

function reportTestSend(result: Awaited<ReturnType<typeof sendMail>>, sent: { readonly masked: string; readonly kind: string }, output: CliOutput): number {
  if (result.ok) {
    output.log(`test mail (${sent.kind}) sent to ${sent.masked}; provider message id ${result.value.id}`);
    return EXIT_OK;
  }
  const status = result.httpStatus === undefined ? "" : ` (HTTP ${String(result.httpStatus)})`;
  output.error(`test mail (${sent.kind}) to ${sent.masked} not sent: ${result.error.slice("mailing.".length)}${status}`);
  return EXIT_FAILED;
}

async function reportSend(
  ctx: DeliveryContext,
  loaded: LoadedCampaign,
  pace: { readonly pauseMs: number; readonly sleep: ((ms: number) => Promise<void>) | undefined; readonly retakeUncertain: boolean; readonly limit: number | null },
  output: CliOutput,
): Promise<number> {
  let handled = 0;
  const total = loaded.recipients.length;
  const result = await sendCampaign(ctx, loaded, {
    pauseMs: pace.pauseMs,
    retakeUncertain: pace.retakeUncertain,
    ...(pace.limit === null ? {} : { limit: pace.limit }),
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
  if (summary.remaining !== null && summary.remaining > 0) output.log(`limit reached: ${String(summary.remaining)} recipient(s) left for the next run`);
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

async function readProcessStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  return Buffer.concat(chunks).toString("utf8");
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
