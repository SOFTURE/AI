import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEPLOY_LOCALES, getDeployMessages, isDeployLocale } from "../messages/index.js";
import { parseDeployReport, writeReleaseReport } from "../notes/release-report.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";
import { readFlags } from "./options.js";

function readText(path: string, shown: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    return fail(`release-report: cannot read ${shown} (${(error as NodeJS.ErrnoException).code ?? "unknown error"}).`);
  }
}

/**
 * `softure-deploy release-report --body=<file> --summary=<deploy-report.json> [--locale=en] [--out=<file>]`: writes the
 * run's pipeline status and, unless the deploy job was skipped, a new deployment row into their sections of the
 * release body, keeping the text around them. A body file that does not exist yet is an empty body.
 */
export function runReleaseReport(args: string[], io: CliIo): void {
  const flags = readFlags("release-report", args, {
    body: { type: "string" },
    summary: { type: "string" },
    locale: { type: "string", default: "en" },
    out: { type: "string" },
  });
  if (flags.body === undefined) fail("release-report: --body is required (the current release body).", USAGE_EXIT_CODE);
  if (flags.summary === undefined) fail("release-report: --summary is required (deploy-report.json).", USAGE_EXIT_CODE);
  if (!isDeployLocale(flags.locale)) {
    fail(`release-report: --locale must be one of ${DEPLOY_LOCALES.join(", ")}.`, USAGE_EXIT_CODE);
  }
  let json: unknown;
  try {
    json = JSON.parse(readText(resolve(io.cwd, flags.summary), flags.summary));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    fail(`release-report: ${flags.summary} is not JSON.`);
  }
  const parsed = parseDeployReport(json);
  if (!parsed.ok) fail(`release-report: ${flags.summary} is not a deploy report: ${parsed.problem}.`);
  const bodyPath = resolve(io.cwd, flags.body);
  const body = existsSync(bodyPath) ? readText(bodyPath, flags.body) : "";
  const notes = writeReleaseReport(body, parsed.report, getDeployMessages(flags.locale));
  if (flags.out === undefined) {
    io.stdout(notes);
    return;
  }
  writeFileSync(resolve(io.cwd, flags.out), notes);
  io.stdout(`release-report: report of ${parsed.report.tag} written to ${flags.out}\n`);
}
