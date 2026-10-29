import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { fetchBuildInfo } from "../smoke/fetch-build-info.js";
import { DEFAULT_TOLERANCE_SECONDS, formatSmokeReport, runSmokeChecks, type SmokeExpectation } from "../smoke/smoke-checks.js";
import { joinUrl, trimTrailingSlashes } from "../verify/checks.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";

export const DEFAULT_BUILD_INFO_PATH = "/api/health/build";

const DEFAULT_TIMEOUT_MS = 10_000;
const TIMEOUT_RANGE = { min: 100, max: 120_000 };
const TOLERANCE_RANGE = { min: 0, max: 3600 };
const TAG = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
const COMMIT = /^[0-9a-f]{7,64}$/i;
const PATH = /^\/[A-Za-z0-9/._~-]*$/;
const HEADER_LINE = /^([A-Za-z0-9-]+): (\P{Cc}+)$/u;
// An ISO 8601 time in UTC or with an offset, as `date -u +%Y-%m-%dT%H:%M:%SZ` writes it.
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

function readSmokeArgs(args: string[]) {
  try {
    return parseArgs({
      args,
      options: {
        tag: { type: "string" },
        commit: { type: "string" },
        "deployed-at": { type: "string" },
        path: { type: "string", default: DEFAULT_BUILD_INFO_PATH },
        "headers-file": { type: "string" },
        timeout: { type: "string" },
        "tolerance-seconds": { type: "string" },
      },
      strict: true,
      allowPositionals: true,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return fail(`smoke: ${reason}`, USAGE_EXIT_CODE);
  }
}

function readBaseUrl(text: string): string {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return fail(`smoke: ${JSON.stringify(text)} is not a URL; pass https://<host>.`, USAGE_EXIT_CODE);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") fail(`smoke: ${url.protocol} is not http or https.`, USAGE_EXIT_CODE);
  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    fail("smoke: the URL must not carry credentials, a query or a fragment.", USAGE_EXIT_CODE);
  }
  return trimTrailingSlashes(`${url.origin}${url.pathname}`);
}

function readInteger(flag: string, text: string | undefined, range: { min: number; max: number }): number | undefined {
  if (text === undefined) return undefined;
  const value = /^\d+$/.test(text) ? Number(text) : Number.NaN;
  if (!(value >= range.min && value <= range.max)) {
    fail(`smoke: --${flag} must be a whole number from ${range.min} to ${range.max}.`, USAGE_EXIT_CODE);
  }
  return value;
}

function readDeployedAt(text: string | undefined): Date | undefined {
  if (text === undefined) return undefined;
  const time = Date.parse(text);
  if (!ISO_TIME.test(text) || Number.isNaN(time)) {
    fail(`smoke: --deployed-at ${JSON.stringify(text)} is not an ISO 8601 time such as 2026-10-29T15:00:00Z.`, USAGE_EXIT_CODE);
  }
  return new Date(time);
}

/** `Name: value` lines; a line is named by its number only, since its value may be a token. */
function readHeaders(path: string | undefined, cwd: string): Record<string, string> {
  if (path === undefined) return {};
  let text: string;
  try {
    text = readFileSync(resolve(cwd, path), "utf8");
  } catch (error) {
    return fail(`smoke: cannot read --headers-file ${path} (${(error as NodeJS.ErrnoException).code ?? "unknown error"}).`);
  }
  const headers: Record<string, string> = {};
  text.split("\n").forEach((rawLine, index) => {
    const line = rawLine.replace(/\r$/, "");
    if (line === "") return;
    const match = HEADER_LINE.exec(line);
    if (match?.[1] === undefined || match[2] === undefined) {
      fail(`smoke: --headers-file line ${index + 1} is not one 'Name: value' header.`, USAGE_EXIT_CODE);
    }
    headers[match[1]] = match[2];
  });
  return headers;
}

function readExpectation(values: ReturnType<typeof readSmokeArgs>["values"]): SmokeExpectation {
  const tag = values.tag;
  if (tag === undefined || !TAG.test(tag)) fail("smoke: pass --tag=<the deployed release tag>.", USAGE_EXIT_CODE);
  if (values.commit !== undefined && !COMMIT.test(values.commit)) {
    fail(`smoke: --commit ${JSON.stringify(values.commit)} is not a commit (7 to 64 hex digits).`, USAGE_EXIT_CODE);
  }
  const deployedAt = readDeployedAt(values["deployed-at"]);
  const toleranceSeconds = readInteger("tolerance-seconds", values["tolerance-seconds"], TOLERANCE_RANGE);
  return {
    tag,
    ...(values.commit === undefined ? {} : { commit: values.commit }),
    ...(deployedAt === undefined ? {} : { deployedAt }),
    toleranceSeconds: toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS,
  };
}

/**
 * `softure-deploy smoke <url> --tag=<tag> [--commit=<sha>] [--deployed-at=<iso>] [--path=/api/health/build]
 * [--headers-file=<file>] [--timeout=<ms>] [--tolerance-seconds=60]`: reads the build info the app answers and fails
 * when the release is not the tag, the commit is not the tag's, or the process started before the deploy.
 */
export async function runSmokeCommand(args: string[], io: CliIo): Promise<void> {
  const { values, positionals } = readSmokeArgs(args);
  if (positionals.length !== 1 || positionals[0] === undefined) {
    fail("smoke: pass exactly one URL, for example softure-deploy smoke https://example.com --tag=v1.2.0", USAGE_EXIT_CODE);
  }
  const baseUrl = readBaseUrl(positionals[0]);
  if (!PATH.test(values.path)) fail(`smoke: --path ${JSON.stringify(values.path)} is not a path starting with /.`, USAGE_EXIT_CODE);
  const expectation = readExpectation(values);
  const timeoutMs = readInteger("timeout", values.timeout, TIMEOUT_RANGE) ?? DEFAULT_TIMEOUT_MS;
  const headers = readHeaders(values["headers-file"], io.cwd);
  const url = joinUrl(baseUrl, values.path);
  const result = await fetchBuildInfo({ url, headers, timeoutMs });
  if (!result.ok) fail(`smoke: ${url}: ${result.reason}.`);
  const checks = runSmokeChecks(result.info, expectation);
  io.stdout(formatSmokeReport(checks, url));
  const failed = checks.filter((check) => !check.passed).map((check) => check.kind);
  if (failed.length > 0) fail(`smoke: production does not run ${expectation.tag}: the ${failed.join(", ")} ${failed.length > 1 ? "checks" : "check"} failed.`);
}
