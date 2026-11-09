import { createHash } from "node:crypto";
import { z } from "zod";

/** What the review looks at, and the rules a finding names (the id hashes the rule, so the list is stable). */
export const CATEGORY_RULES = {
  security: ["missing-authorization", "secret-in-log", "unprotected-public-endpoint", "unsafe-sql", "other-security"],
  errors: ["swallowed-error", "missing-timeout", "other-error-handling"],
  tests: ["untested-logic", "empty-test"],
  "dead-code": ["unused-file", "unused-export", "unused-dependency"],
  conventions: ["agents-md-violation", "local-workaround"],
} as const;

export type Category = keyof typeof CATEGORY_RULES;
export type Rule = (typeof CATEGORY_RULES)[Category][number];

export const CATEGORIES: Category[] = ["security", "errors", "tests", "dead-code", "conventions"];
export const RULES: Rule[] = CATEGORIES.flatMap((category): readonly Rule[] => CATEGORY_RULES[category]);
export const SEVERITIES = ["critical", "warning", "suggestion"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** One finding as the agent emits it, inside `<finding>…</finding>` in its text. */
export const agentFindingSchema = z
  .object({
    category: z.enum(CATEGORIES as [Category, ...Category[]]),
    rule: z.enum(RULES as [Rule, ...Rule[]]),
    severity: z.enum(SEVERITIES),
    file: z.string().min(1),
    line: z.number().int().positive(),
    symbol: z.string().default(""),
    title: z.string().min(1),
    problem: z.string().min(1),
    impact: z.string().min(1),
    fix: z.string().min(1),
  })
  .refine((finding) => (CATEGORY_RULES[finding.category] as readonly string[]).includes(finding.rule), {
    message: "rule does not belong to the category",
    path: ["rule"],
  });

export type AgentFinding = z.infer<typeof agentFindingSchema>;

/** A finding with its stable id. */
export interface Finding extends AgentFinding {
  id: string;
}

const OPEN_TAG = "<finding>";
const CLOSE_TAG = "</finding>";

/** The text inside each `<finding>…</finding>` pair, scanned with indexOf (linear, whatever the agent writes). */
function getFindingBlocks(text: string): string[] {
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

/**
 * The stable id of a finding: the rule, the file and the symbol it is about, never the line (which moves with every
 * edit above it), so the same problem keeps its id from one run to the next and an ignore entry keeps matching.
 */
export function getFindingId(finding: Pick<AgentFinding, "rule" | "file" | "symbol">): string {
  const key = [finding.rule, normalizePath(finding.file), finding.symbol.trim()].join("\n");
  return `QR-${createHash("sha256").update(key).digest("hex").slice(0, 8)}`;
}

/** A repository-relative path with forward slashes and no leading `./`. */
export function normalizePath(path: string): string {
  return path.trim().replaceAll("\\", "/").replace(/^(\.\/)+/, "");
}

export interface ExtractedFindings {
  findings: Finding[];
  /** Blocks that were not a valid finding, with the reason. */
  rejected: string[];
}

/** Reads every `<finding>{json}</finding>` block of the agent's text; a block that is not a valid finding is rejected. */
export function extractFindings(text: string): ExtractedFindings {
  const findings: Finding[] = [];
  const rejected: string[] = [];
  for (const block of getFindingBlocks(text)) {
    const raw = block.trim();
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      rejected.push(`not JSON: ${raw.slice(0, 80)}`);
      continue;
    }
    const parsed = agentFindingSchema.safeParse(json);
    if (!parsed.success) {
      rejected.push(`not a finding (${parsed.error.issues.map((issue) => issue.path.join(".") || issue.message).join(", ")})`);
      continue;
    }
    const finding = { ...parsed.data, file: normalizePath(parsed.data.file) };
    findings.push({ ...finding, id: getFindingId(finding) });
  }
  return { findings, rejected };
}

/** Keeps the first finding of each id (the agent may repeat one). */
export function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    if (seen.has(finding.id)) return false;
    seen.add(finding.id);
    return true;
  });
}
