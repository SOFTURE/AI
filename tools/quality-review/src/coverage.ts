import { isAbsolute, relative } from "node:path";
import { z } from "zod";
import { normalizePath } from "./findings.js";

/**
 * The threat scenarios of the security focus, in the order of `prompt/security-review.md`. A security run accounts for
 * each one (traced, or no surface) before it may end; the report lists them in this order.
 */
export const SECURITY_SCENARIOS = [
  "auth-session",
  "oauth-flow",
  "token-scope",
  "webhook-verification",
  "command-injection",
  "ssrf",
  "csrf",
  "rate-limit",
  "secrets",
  "runtime-hardening",
] as const;
export type SecurityScenario = (typeof SECURITY_SCENARIOS)[number];

/** What the agent says about a scenario: it traced the flows, or the repository has no surface for it. */
export const AGENT_COVERAGE_STATUSES = ["traced", "no-surface"] as const;
/** What the report says: `not-covered` when the agent never accounted for the scenario, or named no file it read. */
export const COVERAGE_STATUSES = [...AGENT_COVERAGE_STATUSES, "not-covered"] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

/** One `<coverage>{json}</coverage>` block of the agent. */
export const agentCoverageSchema = z.object({
  scenario: z.enum(SECURITY_SCENARIOS),
  status: z.enum(AGENT_COVERAGE_STATUSES),
  files: z.array(z.string().min(1)).default([]),
  note: z.string().min(1),
});
export type AgentCoverage = z.infer<typeof agentCoverageSchema>;

/** One row of the report's coverage table. */
export interface CoverageEntry {
  scenario: SecurityScenario;
  status: CoverageStatus;
  /** Repository-relative files the run read for this scenario. */
  files: string[];
  note: string;
}

const OPEN_TAG = "<coverage>";
const CLOSE_TAG = "</coverage>";

function getCoverageBlocks(text: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf(OPEN_TAG, from);
    if (start === -1) return blocks;
    const end = text.indexOf(CLOSE_TAG, start + OPEN_TAG.length);
    if (end === -1) return blocks;
    blocks.push(text.slice(start + OPEN_TAG.length, end));
    from = end + CLOSE_TAG.length;
  }
}

export interface ExtractedCoverage {
  coverage: AgentCoverage[];
  /** Blocks that were not a valid coverage entry, with the reason. */
  rejected: string[];
}

/** Reads every `<coverage>{json}</coverage>` block of the agent's text; an invalid block is rejected with its reason. */
export function extractCoverage(text: string): ExtractedCoverage {
  const coverage: AgentCoverage[] = [];
  const rejected: string[] = [];
  for (const block of getCoverageBlocks(text)) {
    const raw = block.trim();
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      rejected.push(`coverage not JSON: ${raw.slice(0, 80)}`);
      continue;
    }
    const parsed = agentCoverageSchema.safeParse(json);
    if (!parsed.success) {
      rejected.push(`not a coverage entry (${parsed.error.issues.map((issue) => issue.path.join(".") || issue.message).join(", ")})`);
      continue;
    }
    coverage.push({ ...parsed.data, files: parsed.data.files.map(normalizePath) });
  }
  return { coverage, rejected };
}

/** A path the Read tool was given, relative to the repository; null when it points outside it. */
export function toRepositoryPath(repo: string, path: string): string | null {
  const inside = isAbsolute(path) ? relative(repo, path) : path;
  if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) return null;
  return normalizePath(inside);
}

const NOT_COVERED_NOTE = "The run did not account for this scenario.";

/**
 * One entry per scenario, in the prompt's order. The agent's last block for a scenario wins; its files are kept only
 * when the run really read them, and a traced scenario left with no file it read is not covered.
 */
export function resolveCoverage(blocks: AgentCoverage[], filesRead: ReadonlySet<string>): CoverageEntry[] {
  const latest = new Map<SecurityScenario, AgentCoverage>();
  for (const block of blocks) latest.set(block.scenario, block);
  return SECURITY_SCENARIOS.map((scenario): CoverageEntry => {
    const block = latest.get(scenario);
    if (block === undefined) return { scenario, status: "not-covered", files: [], note: NOT_COVERED_NOTE };
    const files = [...new Set(block.files)].filter((file) => filesRead.has(file));
    if (block.status === "traced" && files.length === 0) {
      return { scenario, status: "not-covered", files: [], note: `Claimed as traced, but named no file the run read. ${block.note}` };
    }
    return { scenario, status: block.status, files, note: block.note };
  });
}

/** The scenarios a run has not accounted for yet. */
export function getMissingScenarios(coverage: CoverageEntry[]): SecurityScenario[] {
  return coverage.filter((entry) => entry.status === "not-covered").map((entry) => entry.scenario);
}
