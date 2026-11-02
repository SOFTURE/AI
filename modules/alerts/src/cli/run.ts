// `softure-alerts`: `test` sends a test message to each configured channel at once, without the queue or a database,
// and reports each channel's outcome. The app passes its validated config, so the same function serves the bin and
// an app script that a bundler packs for a container:
//
//   // scripts/alerts.ts
//   import { runAlertsCli } from "@softure-ai/alerts/cli";
//   import config from "../softure.config";
//   process.exitCode = await runAlertsCli({ config, argv: process.argv.slice(2) });
import { parseArgs } from "node:util";
import { formatMessage, systemClock, type Clock, type SoftureConfig } from "@softure-ai/core";
import { ALERT_SEVERITIES, type AlertMessage, type AlertSeverity } from "../contract.js";
import { deliverToChannel } from "../server/deliver.js";
import { getAlertsMessages, getAlertsOptions } from "../server/options.js";

export interface CliOutput {
  readonly log: (line: string) => void;
  readonly error: (line: string) => void;
}

export interface RunAlertsCliOptions {
  /** The app's config; required by `test`. */
  readonly config?: SoftureConfig;
  /** The arguments after the executable, e.g. `["test", "--channel", "ops"]`. */
  readonly argv: readonly string[];
  readonly output?: CliOutput;
  readonly clock?: Clock;
}

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

export const ALERTS_USAGE = `Usage:
  softure-alerts test [--channel <name>] [--severity info|warning|critical] [--config <file>]

  test   sends a test message to every channel (or only --channel) right away, without the queue,
         and prints each channel's outcome; exits 1 when any channel failed.`;

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

export async function runAlertsCli(options: RunAlertsCliOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const [command, ...rest] = options.argv;
  if (command === undefined || command === "--help" || command === "help") {
    output.log(ALERTS_USAGE);
    return command === undefined ? EXIT_USAGE : EXIT_OK;
  }
  if (command !== "test") {
    output.error(`softure-alerts: unknown command "${command}"`);
    output.error(ALERTS_USAGE);
    return EXIT_USAGE;
  }
  let values: { channel?: string | undefined; severity?: string | undefined };
  try {
    ({ values } = parseArgs({ args: [...rest], options: { channel: { type: "string" }, severity: { type: "string" } }, strict: true }));
  } catch (error) {
    output.error(`softure-alerts: ${error instanceof Error ? error.message : "invalid arguments"}`);
    output.error(ALERTS_USAGE);
    return EXIT_USAGE;
  }
  const severity = values.severity ?? "info";
  if (!isSeverity(severity)) {
    output.error(`softure-alerts: --severity must be one of ${ALERT_SEVERITIES.join(", ")}`);
    return EXIT_USAGE;
  }
  if (options.config === undefined) {
    output.error("softure-alerts: test needs the app's config");
    return EXIT_FAILED;
  }
  return runTest(options.config, { channel: values.channel, severity }, options.clock ?? systemClock, output);
}

async function runTest(
  config: SoftureConfig,
  input: { readonly channel: string | undefined; readonly severity: AlertSeverity },
  clock: Clock,
  output: CliOutput,
): Promise<number> {
  const channels = Object.keys(getAlertsOptions(config).channels);
  if (input.channel !== undefined && !channels.includes(input.channel)) {
    output.error(`softure-alerts: no channel "${input.channel}"; configured: ${channels.join(", ")}`);
    return EXIT_USAGE;
  }
  const targets = input.channel === undefined ? channels : [input.channel];
  const messages = getAlertsMessages(config);
  let failed = 0;
  for (const name of targets) {
    const message: AlertMessage = {
      kind: "test",
      key: "alerts.test",
      severity: input.severity,
      title: messages.test.title,
      details: formatMessage(messages.test.details, { channel: name }),
      link: null,
      repeats: 0,
      occurrences: 1,
      at: clock.now().toISOString(),
    };
    // Codes only: a channel's URL or token never reaches the output.
    const result = await deliverToChannel(config, name, message);
    if (result.ok) {
      output.log(`${name}: sent`);
    } else {
      failed += 1;
      output.error(`${name}: ${result.error}`);
    }
  }
  return failed === 0 ? EXIT_OK : EXIT_FAILED;
}

function isSeverity(value: string): value is AlertSeverity {
  return (ALERT_SEVERITIES as readonly string[]).includes(value);
}
