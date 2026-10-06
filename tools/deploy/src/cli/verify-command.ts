import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { trimTrailingSlashes } from "../verify/checks.js";
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
 * `softure-deploy verify <url> [--config=deploy.json] [--timeout=<ms>] [--concurrency=4]`: requests every route of
 * the `verify` section and prints a table; any failed check is exit code 1.
 */
export async function runVerifyCommand(args: string[], io: CliIo): Promise<void> {
  const { values, positionals } = readVerifyArgs(args);
  if (positionals.length !== 1 || positionals[0] === undefined) {
    fail("verify: pass exactly one URL, for example softure-deploy verify https://example.com", USAGE_EXIT_CODE);
  }
  const baseUrl = readBaseUrl(positionals[0]);
  const timeoutMs = readInteger("timeout", values.timeout, TIMEOUT_RANGE);
  const concurrency = readInteger("concurrency", values.concurrency, { min: 1, max: MAX_CONCURRENCY }) ?? DEFAULT_CONCURRENCY;
  const config = readVerifyConfig(resolve(io.cwd, values.config), values.config);
  const reports = await runVerify({ baseUrl, config, concurrency, ...(timeoutMs === undefined ? {} : { timeoutMs }) });
  io.stdout(formatVerifyReport(reports, baseUrl));
  const failed = reports.filter((report) => !report.passed).length;
  if (failed > 0) fail(`verify: ${failed} of ${reports.length} routes failed.`);
}
