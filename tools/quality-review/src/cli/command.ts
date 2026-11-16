import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { DEFAULT_BUDGET_USD, DEFAULT_MAX_TURNS, DEFAULT_MODEL } from "../agent.js";
import { FOCUSES, type Focus } from "../findings.js";
import { DEFAULT_REPORT_PATH, parseReport } from "../report.js";
import { loadQuery, runReview, type QueryFunction } from "../review.js";
import { getDefaultReportPath, getPathsProblem, getScopeSlug, parsePaths, resolveScope, type Scope } from "../scope.js";

export interface CommandContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
  write: (text: string) => void;
  writeError: (text: string) => void;
  /** Replaces the Agent SDK in tests. */
  loadQuery?: () => Promise<QueryFunction>;
}

export const USAGE = `Usage:
  softure-quality-review run [--repo <dir>] [--out ${DEFAULT_REPORT_PATH}] [--model ${DEFAULT_MODEL}]
                             [--max-budget-usd ${String(DEFAULT_BUDGET_USD)}] [--max-turns ${String(DEFAULT_MAX_TURNS)}] [--commit <sha>]
                             [--focus general|security] [--scope <folder|package>] [--paths <glob>[,<glob>…]]
  softure-quality-review resolve [--repo <dir>] [--out <path>] [--focus general|security] [--scope <folder|package>]
  softure-quality-review check [<report>]

run      reviews the repository (or one scope of it) with the read-only agent (needs ANTHROPIC_API_KEY and
         @anthropic-ai/claude-agent-sdk installed next to this package) and replaces the report.
resolve  checks the focus and the scope without a model call and prints the report path and the branch suffix
         as key=value lines (for GITHUB_OUTPUT).
check    validates a report against the documented format and lists what is wrong.`;

function getCommit(repo: string, env: NodeJS.ProcessEnv): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return env.GITHUB_SHA ?? "unknown";
  }
}

function parseNumber(name: string, value: string | undefined, fallback: number): number | string {
  if (value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : `--${name} must be a number above 0, not "${value}"`;
}

type FocusResult = { ok: true; focus: Focus } | { ok: false; error: string };

function isFocus(value: string): value is Focus {
  return (FOCUSES as readonly string[]).includes(value);
}

function parseFocus(value: string | undefined): FocusResult {
  if (value === undefined || value === "") return { ok: true, focus: "general" };
  return isFocus(value) ? { ok: true, focus: value } : { ok: false, error: `--focus must be one of ${FOCUSES.join(", ")}, not "${value}"` };
}

/** An empty value means "not set", so a workflow can always pass its input through. */
function toOptional(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

async function runRun(args: string[], context: CommandContext): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      repo: { type: "string", default: "." },
      out: { type: "string" },
      model: { type: "string", default: DEFAULT_MODEL },
      "max-budget-usd": { type: "string" },
      "max-turns": { type: "string" },
      commit: { type: "string" },
      focus: { type: "string" },
      scope: { type: "string" },
      paths: { type: "string", multiple: true },
    },
  });
  const budget = parseNumber("max-budget-usd", values["max-budget-usd"], DEFAULT_BUDGET_USD);
  const turns = parseNumber("max-turns", values["max-turns"], DEFAULT_MAX_TURNS);
  const focus = parseFocus(values.focus);
  const paths = parsePaths(values.paths ?? []);
  const pathsProblem = getPathsProblem(paths);
  for (const value of [budget, turns, pathsProblem, focus.ok ? null : focus.error]) {
    if (typeof value === "string") {
      context.writeError(`${value}\n`);
      return 2;
    }
  }
  const repo = resolve(context.cwd, values.repo);
  const scopeValue = toOptional(values.scope);
  if (scopeValue !== undefined) {
    const resolved = resolveScope(repo, scopeValue);
    if (!resolved.ok) {
      context.writeError(`${resolved.error}\n`);
      return 2;
    }
  }
  if ((context.env.ANTHROPIC_API_KEY ?? "") === "") {
    context.writeError("ANTHROPIC_API_KEY is not set: add it as a repository secret and pass it to the workflow\n");
    return 2;
  }
  const query = await (context.loadQuery ?? loadQuery)();
  const outcome = await runReview({
    repo,
    out: toOptional(values.out),
    focus: focus.ok ? focus.focus : "general",
    paths,
    ...(scopeValue === undefined ? {} : { scope: scopeValue }),
    model: values.model,
    budgetUsd: budget as number,
    maxTurns: Math.floor(turns as number),
    commit: values.commit ?? getCommit(repo, context.env),
    query,
    env: context.env,
  });
  if (!outcome.ok) {
    context.writeError(`${outcome.error} (cost ${outcome.costUsd.toFixed(4)} USD); no report was written\n`);
    return 1;
  }
  for (const note of outcome.notes) context.write(`note: ${note}\n`);
  const { header, findings } = outcome.report;
  context.write(
    `Report written to ${outcome.path}: ${String(findings.length)} findings, status ${header.status}, ` +
      `${header.costUsd.toFixed(4)} USD of ${header.budgetUsd.toFixed(2)} USD, model ${header.model}\n`,
  );
  return 0;
}

/** The branch suffix of a run: `security` for the security focus, then the scope's slug; empty for a general whole run. */
export function getBranchSuffix(focus: Focus, scope: Scope | null): string {
  return [focus === "general" ? "" : focus, scope === null ? "" : getScopeSlug(scope)].filter((part) => part !== "").join("/");
}

function runResolve(args: string[], context: CommandContext): number {
  const { values } = parseArgs({
    args,
    options: {
      repo: { type: "string", default: "." },
      out: { type: "string" },
      focus: { type: "string" },
      scope: { type: "string" },
    },
  });
  const focus = parseFocus(values.focus);
  if (!focus.ok) {
    context.writeError(`${focus.error}\n`);
    return 2;
  }
  let scope: Scope | null = null;
  const scopeValue = toOptional(values.scope);
  if (scopeValue !== undefined) {
    const resolved = resolveScope(resolve(context.cwd, values.repo), scopeValue);
    if (!resolved.ok) {
      context.writeError(`${resolved.error}\n`);
      return 2;
    }
    scope = resolved.scope;
  }
  context.write(
    [
      `report-path=${toOptional(values.out) ?? getDefaultReportPath(scope)}`,
      `branch-suffix=${getBranchSuffix(focus.focus, scope)}`,
      `scope-folder=${scope?.folder ?? ""}`,
      `focus=${focus.focus}`,
    ].join("\n") + "\n",
  );
  return 0;
}

function runCheck(args: string[], context: CommandContext): number {
  const file = resolve(context.cwd, args[0] ?? DEFAULT_REPORT_PATH);
  if (!existsSync(file)) {
    context.writeError(`${file} does not exist\n`);
    return 1;
  }
  const result = parseReport(readFileSync(file, "utf8"));
  if (!result.ok) {
    context.writeError(`${file} does not follow the report format:\n${result.errors.map((error) => `- ${error}`).join("\n")}\n`);
    return 1;
  }
  context.write(`${file} is a valid report: ${String(result.report.findings.length)} findings, status ${result.report.header.status}\n`);
  return 0;
}

/** Runs the CLI and returns its exit code. */
export async function runCommand(argv: string[], context: CommandContext): Promise<number> {
  const [command, ...args] = argv;
  try {
    if (command === "run") return await runRun(args, context);
    if (command === "resolve") return runResolve(args, context);
    if (command === "check") return runCheck(args, context);
  } catch (error) {
    context.writeError(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  context.writeError(`${USAGE}\n`);
  return command === undefined || command === "--help" ? 0 : 2;
}
