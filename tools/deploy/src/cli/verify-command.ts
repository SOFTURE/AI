import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { trimTrailingSlashes } from "../verify/checks.js";
import { parseOriginAddress, type OriginAddress } from "../verify/origin-check.js";
import { formatVerifyReport } from "../verify/report.js";
import { DEFAULT_CONCURRENCY, runVerify } from "../verify/run-checks.js";
import type { VerifyConfig } from "../verify/schema.js";
import { DEFAULT_DEPLOY_CONFIG, readDeployConfig } from "./deploy-config.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";

const MAX_CONCURRENCY = 32;
const TIMEOUT_RANGE = { min: 100, max: 120_000 };

/** The URL to verify: http or https, no credentials, query or fragment; returned without a trailing slash. */
function readBaseUrl(text: string): string {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return fail(`verify: ${JSON.stringify(text)} is not a URL; pass https://<host>[/<path>].`, USAGE_EXIT_CODE);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    fail(`verify: ${url.protocol} is not http or https.`, USAGE_EXIT_CODE);
  }
  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    fail("verify: the URL must not carry credentials, a query or a fragment.", USAGE_EXIT_CODE);
  }
  return trimTrailingSlashes(`${url.origin}${url.pathname}`);
}

function readInteger(flag: string, text: string | undefined, range: { min: number; max: number }): number | undefined {
  if (text === undefined) return undefined;
  const value = /^\d+$/.test(text) ? Number(text) : Number.NaN;
  if (!(value >= range.min && value <= range.max)) {
    fail(`verify: --${flag} must be a whole number from ${range.min} to ${range.max}.`, USAGE_EXIT_CODE);
  }
  return value;
}

function readOrigin(text: string | undefined): OriginAddress | undefined {
  if (text === undefined) return undefined;
  const parsed = parseOriginAddress(text);
  if (!parsed.ok) return fail(`verify: --origin: ${parsed.reason}.`, USAGE_EXIT_CODE);
  return parsed.address;
}

function readVerifyConfig(path: string, shownPath: string): VerifyConfig {
  const config = readDeployConfig("verify", path, shownPath);
  if (config.verify === undefined) return fail(`verify: ${shownPath} has no "verify" section; nothing to check.`);
  return config.verify;
}

function readVerifyArgs(args: string[]) {
  try {
    return parseArgs({
      args,
      options: {
        config: { type: "string", default: DEFAULT_DEPLOY_CONFIG },
        timeout: { type: "string" },
        concurrency: { type: "string" },
        origin: { type: "string" },
      },
      strict: true,
      allowPositionals: true,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return fail(`verify: ${reason}`, USAGE_EXIT_CODE);
  }
}

/**
 * `softure-deploy verify <url> [--config=deploy.json] [--timeout=<ms>] [--concurrency=4] [--origin=<host>[:<port>]]`:
 * requests every route of the `verify` section (reads the certificate with `tlsMinDays`, and with `--origin` checks
 * that the server behind the CDN refuses a direct connection) and prints a table; any failed check is exit code 1.
 */
export async function runVerifyCommand(args: string[], io: CliIo): Promise<void> {
  const { values, positionals } = readVerifyArgs(args);
  if (positionals.length !== 1 || positionals[0] === undefined) {
    fail("verify: pass exactly one URL, for example softure-deploy verify https://example.com", USAGE_EXIT_CODE);
  }
  const baseUrl = readBaseUrl(positionals[0]);
  const timeoutMs = readInteger("timeout", values.timeout, TIMEOUT_RANGE);
  const concurrency = readInteger("concurrency", values.concurrency, { min: 1, max: MAX_CONCURRENCY }) ?? DEFAULT_CONCURRENCY;
  const origin = readOrigin(values.origin);
  const config = readVerifyConfig(resolve(io.cwd, values.config), values.config);
  const report = await runVerify({
    baseUrl,
    config,
    concurrency,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    ...(origin === undefined ? {} : { origin }),
  });
  io.stdout(formatVerifyReport(report, baseUrl));
  const failed = report.routes.filter((route) => !route.passed).length;
  const problems = [
    ...(failed > 0 ? [`${failed} of ${report.routes.length} routes failed`] : []),
    ...(report.tls?.passed === false ? ["the TLS certificate check failed"] : []),
    ...(report.origin?.passed === false ? [`the origin ${report.origin.address} is not closed to direct traffic`] : []),
  ];
  if (problems.length > 0) fail(`verify: ${problems.join("; ")}.`);
}
