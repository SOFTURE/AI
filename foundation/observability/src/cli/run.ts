import { readFile } from "node:fs/promises";

import type { Environment } from "../node/config.js";
import { applyGrafanaResources } from "../node/grafana/apply.js";
import type { GrafanaDashboard, ParseResult } from "../node/grafana/rules-file.js";
import { parseGrafanaDashboard, parseGrafanaRulesFile } from "../node/grafana/rules-file.js";
import type { ProbeOptions, ProbeResult } from "../node/probe.js";
import { probeObservability } from "../node/probe.js";

export type CliOutput = { log(line: string): void; error(line: string): void };

export type RunObservabilityCliOptions = {
  argv: readonly string[];
  env: Environment;
  output: CliOutput;
  /** Default: `readFile` from `node:fs/promises` as UTF-8. */
  readTextFile?: (path: string) => Promise<string>;
  /** Default: the global `fetch`. */
  fetch?: typeof fetch;
};

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

export const OBSERVABILITY_USAGE = `Usage: softure-observability ping [--service-name <name>]
       softure-observability grafana apply --rules <file> [--dashboard <file>] [--commit] [--paused]

  ping            Sends one probe span and one probe log record (softure.probe=true) to the OTLP endpoint from the
                  OTEL_* variables and exits non-zero when either export is refused or no endpoint is set.
  grafana apply   Applies a rules file (and a dashboard) to the Grafana at GRAFANA_URL with GRAFANA_TOKEN. Without
                  --commit it only reads Grafana and prints what would change. --commit creates the folder when
                  missing, replaces the rule group and upserts the dashboard; it refuses when the contact point does
                  not exist. --paused applies every rule paused.`;

type GrafanaApplyArgs = { rulesPath: string; dashboardPath?: string; isCommit: boolean; isPaused: boolean };

type ParsedArgs =
  | { kind: "help" }
  | { kind: "ping"; options: ProbeOptions }
  | { kind: "grafana-apply"; args: GrafanaApplyArgs }
  | { kind: "usage"; problem: string };

/** `softure-observability`: the command behind the bin, with its environment and output passed in. */
export async function runObservabilityCli(options: RunObservabilityCliOptions): Promise<number> {
  const { output } = options;
  const parsed = parseArgs(options.argv);
  if (parsed.kind === "help") {
    output.log(OBSERVABILITY_USAGE);
    return EXIT_OK;
  }
  if (parsed.kind === "usage") {
    output.error(`softure-observability: ${parsed.problem}`);
    output.error(OBSERVABILITY_USAGE);
    return EXIT_USAGE;
  }
  if (parsed.kind === "grafana-apply") {
    return runGrafanaApply(parsed.args, options);
  }

  let result: ProbeResult;
  try {
    result = await probeObservability(parsed.options, options.env);
  } catch (error) {
    // Configuration errors name the variable that is wrong, never its value.
    output.error(`softure-observability: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT_FAILED;
  }
  return reportResult(result, output);
}

function reportResult(result: ProbeResult, output: CliOutput): number {
  if (result.kind === "disabled") {
    output.error(`softure-observability: nothing to check, export is disabled (${result.reason})`);
    return EXIT_FAILED;
  }
  for (const signal of result.signals) {
    if (signal.outcome === "accepted") {
      output.log(`${signal.signal}: accepted by ${signal.target}`);
    } else if (signal.outcome === "not configured") {
      output.log(`${signal.signal}: not configured`);
    } else {
      const status = signal.status === null ? "no response" : `HTTP ${String(signal.status)}`;
      output.error(`${signal.signal}: refused by ${signal.target} (${status}: ${signal.problem})`);
    }
  }
  return result.isAccepted ? EXIT_OK : EXIT_FAILED;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command, ...rest] = argv;
  if (command === undefined || command === "--help" || command === "-h" || rest.includes("--help")) {
    return command === undefined ? { kind: "usage", problem: "missing command" } : { kind: "help" };
  }
  if (command === "grafana") {
    return parseGrafanaArgs(rest);
  }
  if (command !== "ping") {
    return { kind: "usage", problem: `unknown command "${command}"` };
  }

  const options: ProbeOptions = {};
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index] ?? "";
    if (arg === "--service-name") {
      const value = rest[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return { kind: "usage", problem: "--service-name needs a value" };
      }
      options.serviceName = value;
      index += 1;
    } else if (arg.startsWith("--service-name=")) {
      options.serviceName = arg.slice("--service-name=".length);
    } else {
      return { kind: "usage", problem: `unknown option "${arg}"` };
    }
  }
  return { kind: "ping", options };
}

async function runGrafanaApply(args: GrafanaApplyArgs, options: RunObservabilityCliOptions): Promise<number> {
  const { output, env } = options;
  const url = env["GRAFANA_URL"]?.trim() ?? "";
  const token = env["GRAFANA_TOKEN"]?.trim() ?? "";
  const missing = [url === "" ? "GRAFANA_URL" : undefined, token === "" ? "GRAFANA_TOKEN" : undefined].filter(
    (name) => name !== undefined,
  );
  if (missing.length > 0) {
    output.error(`softure-observability: ${missing.join(" and ")} must be set`);
    return EXIT_FAILED;
  }

  const readTextFile = options.readTextFile ?? ((path: string) => readFile(path, "utf8"));
  const rules = await readJsonFile(args.rulesPath, parseGrafanaRulesFile, readTextFile, output);
  if (rules === undefined) {
    return EXIT_FAILED;
  }
  let dashboard: GrafanaDashboard | undefined;
  if (args.dashboardPath !== undefined) {
    dashboard = await readJsonFile(args.dashboardPath, parseGrafanaDashboard, readTextFile, output);
    if (dashboard === undefined) {
      return EXIT_FAILED;
    }
  }

  const result = await applyGrafanaResources({
    url,
    token,
    rules,
    ...(dashboard === undefined ? {} : { dashboard }),
    commit: args.isCommit,
    paused: args.isPaused,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  for (const step of result.steps) {
    output.log(step);
  }
  if (result.kind === "planned") {
    output.log("dry run: nothing was changed; pass --commit to apply");
    return EXIT_OK;
  }
  if (result.kind === "applied") {
    return EXIT_OK;
  }
  output.error(`softure-observability: ${result.kind === "refused" ? "refused" : "failed"}: ${result.problem}`);
  return EXIT_FAILED;
}

async function readJsonFile<T>(
  path: string,
  parse: (input: unknown) => ParseResult<T>,
  readTextFile: (path: string) => Promise<string>,
  output: CliOutput,
): Promise<T | undefined> {
  let text: string;
  try {
    text = await readTextFile(path);
  } catch (error) {
    output.error(`softure-observability: cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    output.error(`softure-observability: ${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
  const parsed = parse(json);
  if (!parsed.isValid) {
    output.error(`softure-observability: ${path} is not valid:`);
    for (const problem of parsed.problems) {
      output.error(`  ${problem}`);
    }
    return undefined;
  }
  return parsed.value;
}

function parseGrafanaArgs(argv: readonly string[]): ParsedArgs {
  const [subcommand, ...rest] = argv;
  if (subcommand !== "apply") {
    return { kind: "usage", problem: subcommand === undefined ? "grafana needs a subcommand" : `unknown grafana subcommand "${subcommand}"` };
  }
  let rulesPath: string | undefined;
  let dashboardPath: string | undefined;
  let isCommit = false;
  let isPaused = false;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index] ?? "";
    if (arg === "--commit") {
      isCommit = true;
    } else if (arg === "--paused") {
      isPaused = true;
    } else if (arg === "--rules" || arg === "--dashboard") {
      const value = rest[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return { kind: "usage", problem: `${arg} needs a value` };
      }
      if (arg === "--rules") {
        rulesPath = value;
      } else {
        dashboardPath = value;
      }
      index += 1;
    } else if (arg.startsWith("--rules=")) {
      rulesPath = arg.slice("--rules=".length);
    } else if (arg.startsWith("--dashboard=")) {
      dashboardPath = arg.slice("--dashboard=".length);
    } else {
      return { kind: "usage", problem: `unknown option "${arg}"` };
    }
  }
  if (rulesPath === undefined || rulesPath === "") {
    return { kind: "usage", problem: "grafana apply needs --rules <file>" };
  }
  return {
    kind: "grafana-apply",
    args: { rulesPath, isCommit, isPaused, ...(dashboardPath === undefined ? {} : { dashboardPath }) },
  };
}
