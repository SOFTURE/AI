import type { ProbeOptions, ProbeResult } from "../node/probe.js";
import { probeObservability } from "../node/probe.js";
import type { Environment } from "../node/config.js";

export type CliOutput = { log(line: string): void; error(line: string): void };

export type RunObservabilityCliOptions = {
  argv: readonly string[];
  env: Environment;
  output: CliOutput;
};

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

export const OBSERVABILITY_USAGE = `Usage: softure-observability ping [--service-name <name>]

  ping   Sends one probe span and one probe log record (softure.probe=true) to the OTLP endpoint from the
         OTEL_* variables and exits non-zero when either export is refused or no endpoint is set.`;

type ParsedArgs = { kind: "help" } | { kind: "ping"; options: ProbeOptions } | { kind: "usage"; problem: string };

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
