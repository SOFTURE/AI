import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { DEFAULT_BUDGET_USD, DEFAULT_MAX_TURNS, DEFAULT_MODEL, buildAgentOptions, type ReviewAgentOptions } from "./agent.js";
import { dedupeFindings, extractFindings, type Finding } from "./findings.js";
import { applyIgnoreRules, readIgnoreRules, type IgnoreRule } from "./ignore.js";
import { DEFAULT_REPORT_PATH, renderReport, type Report, type RunStatus, type TokenCounts } from "./report.js";
import { verifyLocations } from "./verify.js";

/** The Agent SDK's `query`, as this package calls it. Tests pass a fake; a run imports the real one. */
export type QueryFunction = (params: { prompt: string; options: ReviewAgentOptions }) => AsyncIterable<unknown>;

export const AGENT_SDK = "@anthropic-ai/claude-agent-sdk";

/** Imports `query` from the Agent SDK, an optional peer the workflow installs next to this package. */
export async function loadQuery(): Promise<QueryFunction> {
  const name: string = AGENT_SDK;
  let sdk: unknown;
  try {
    sdk = await import(name);
  } catch (error) {
    throw new Error(`Loading ${AGENT_SDK} failed: install it next to @softure-ai/quality-review (${String(error)})`, { cause: error });
  }
  const query = (sdk as { query?: unknown }).query;
  if (typeof query !== "function") throw new Error(`${AGENT_SDK} has no query function`);
  return query as QueryFunction;
}

/** The shared review prompt, kept in this package so every app gets the same standard. */
export function readReviewPrompt(): string {
  return readFileSync(new URL("../prompt/quality-review.md", import.meta.url), "utf8");
}

const textBlockSchema = z.object({ type: z.literal("text"), text: z.string() });
const assistantSchema = z.object({
  type: z.literal("assistant"),
  message: z.object({ content: z.array(z.unknown()) }),
});
const initSchema = z.object({ type: z.literal("system"), subtype: z.literal("init"), model: z.string() });
const modelUsageSchema = z.object({
  inputTokens: z.number().default(0),
  outputTokens: z.number().default(0),
  cacheReadInputTokens: z.number().default(0),
  cacheCreationInputTokens: z.number().default(0),
  costUSD: z.number().default(0),
});
const resultSchema = z.object({
  type: z.literal("result"),
  subtype: z.string(),
  is_error: z.boolean().default(false),
  total_cost_usd: z.number().default(0),
  modelUsage: z.record(z.string(), modelUsageSchema).default({}),
  errors: z.array(z.string()).optional(),
  result: z.string().optional(),
});

type ResultMessage = z.infer<typeof resultSchema>;

export interface ReviewInput {
  repo: string;
  /** Where the report goes, relative to the repository. */
  out?: string;
  model?: string;
  budgetUsd?: number;
  maxTurns?: number;
  commit: string;
  now?: Date;
  query: QueryFunction;
  env?: NodeJS.ProcessEnv;
  prompt?: string;
}

export type ReviewOutcome =
  | {
      ok: true;
      path: string;
      report: Report;
      /** Agent blocks that were not findings, and findings whose location did not exist. */
      notes: string[];
    }
  | { ok: false; error: string; costUsd: number };

function getStatus(result: ResultMessage): RunStatus | null {
  if (result.subtype === "error_max_budget_usd") return "budget";
  if (result.subtype === "error_max_turns") return "turns";
  if (result.subtype === "success" && !result.is_error) return "complete";
  return null;
}

function sumTokens(result: ResultMessage): TokenCounts {
  const tokens: TokenCounts = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const usage of Object.values(result.modelUsage)) {
    tokens.input += usage.inputTokens;
    tokens.output += usage.outputTokens;
    tokens.cacheRead += usage.cacheReadInputTokens;
    tokens.cacheWrite += usage.cacheCreationInputTokens;
  }
  return tokens;
}

/** The models that ran, the most expensive first; the requested one when the result names none. */
function describeModels(result: ResultMessage, initModel: string | null, requested: string): string {
  const models = Object.entries(result.modelUsage)
    .sort(([, a], [, b]) => b.costUSD - a.costUSD)
    .map(([model]) => model);
  if (models.length === 0) return initModel ?? requested;
  return models.join(" + ");
}

function describeIgnoreRules(rules: IgnoreRule[]): string {
  if (rules.length === 0) return "The repository has no accepted exceptions.";
  const lines = rules.map((rule) => {
    switch (rule.kind) {
      case "id":
        return `- finding ${rule.id}`;
      case "rule":
        return `- rule ${rule.rule}${rule.glob === null ? "" : ` in ${rule.glob}`}`;
      case "path":
        return `- everything in ${rule.glob}`;
    }
  });
  return ["Accepted exceptions (do not spend effort on them; they are filtered out anyway):", ...lines].join("\n");
}

function buildTask(commit: string, out: string, rules: IgnoreRule[]): string {
  return [
    `Review the whole repository in your working directory, at commit ${commit}, as the instructions describe.`,
    `Do not read ${out} or any earlier quality report: this run starts from scratch.`,
    describeIgnoreRules(rules),
    "Emit every verified finding as a <finding> block as soon as you have verified it, then end with a one-line summary.",
  ].join("\n\n");
}

/**
 * Runs one full review and writes the report. The previous report is deleted before the agent starts, so nothing of
 * it reaches the agent or the new file. A run that ends at the budget or the turn cap still writes the findings it
 * verified, marked as stopped; a run that fails writes nothing.
 */
export async function runReview(input: ReviewInput): Promise<ReviewOutcome> {
  const repo = resolve(input.repo);
  const out = input.out ?? DEFAULT_REPORT_PATH;
  const path = resolve(repo, out);
  const model = input.model ?? DEFAULT_MODEL;
  const budgetUsd = input.budgetUsd ?? DEFAULT_BUDGET_USD;
  if (!(budgetUsd > 0)) return { ok: false, error: `The budget must be above 0 USD, not ${String(budgetUsd)}`, costUsd: 0 };
  if (existsSync(path)) rmSync(path);

  const ignore = readIgnoreRules(repo);
  const options = buildAgentOptions({
    repo,
    model,
    budgetUsd,
    maxTurns: input.maxTurns ?? DEFAULT_MAX_TURNS,
    systemPrompt: input.prompt ?? readReviewPrompt(),
    env: input.env ?? process.env,
  });

  const emitted: Finding[] = [];
  const notes: string[] = ignore.invalid.map((line) => `ignored exception line (not id, rule or path): ${line}`);
  let initModel: string | null = null;
  let result: ResultMessage | null = null;
  try {
    for await (const message of input.query({ prompt: buildTask(input.commit, out, ignore.rules), options })) {
      const init = initSchema.safeParse(message);
      if (init.success) initModel = init.data.model;
      const assistant = assistantSchema.safeParse(message);
      if (assistant.success) {
        for (const block of assistant.data.message.content) {
          const text = textBlockSchema.safeParse(block);
          if (!text.success) continue;
          const extracted = extractFindings(text.data.text);
          emitted.push(...extracted.findings);
          notes.push(...extracted.rejected.map((reason) => `rejected agent block: ${reason}`));
        }
      }
      const parsed = resultSchema.safeParse(message);
      if (parsed.success) result = parsed.data;
    }
  } catch (error) {
    return { ok: false, error: `The review agent failed: ${error instanceof Error ? error.message : String(error)}`, costUsd: result?.total_cost_usd ?? 0 };
  }
  if (result === null) return { ok: false, error: "The review agent ended without a result", costUsd: 0 };
  const status = getStatus(result);
  if (status === null) {
    const detail = [...(result.errors ?? []), result.result ?? ""].filter((text) => text !== "").join("; ");
    return { ok: false, error: `The review agent ended with ${result.subtype}${detail === "" ? "" : `: ${detail}`}`, costUsd: result.total_cost_usd };
  }

  const verified = verifyLocations(repo, dedupeFindings(emitted));
  notes.push(...verified.dropped.map((reason) => `dropped finding: ${reason}`));
  const filtered = applyIgnoreRules(verified.findings, ignore.rules);
  const report: Report = {
    header: {
      date: (input.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z"),
      commit: input.commit,
      model: describeModels(result, initModel, model),
      costUsd: result.total_cost_usd,
      budgetUsd,
      tokens: sumTokens(result),
      status,
      ignored: filtered.ignored.length,
    },
    findings: filtered.findings,
  };
  writeFileSync(path, renderReport(report));
  return { ok: true, path, report, notes };
}
