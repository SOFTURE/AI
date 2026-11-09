import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AgentFinding } from "../src/findings.js";

export function makeRepo(files: Record<string, string> = {}): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "quality-review-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

export function makeAgentFinding(overrides: Partial<AgentFinding> = {}): AgentFinding {
  return {
    category: "security",
    rule: "missing-authorization",
    severity: "critical",
    file: "src/actions.ts",
    line: 3,
    symbol: "deleteProject",
    title: "deleteProject deletes any project",
    problem: "No ownership check before the delete.",
    impact: "Any user can delete any project.",
    fix: "Check the owner in the WHERE clause.",
    ...overrides,
  };
}

export function toBlock(finding: AgentFinding): string {
  return `<finding>${JSON.stringify(finding)}</finding>`;
}

/** Ten lines, so a finding at line 3 exists. */
export const SOURCE = Array.from({ length: 10 }, (_, index) => `line ${String(index + 1)}`).join("\n");
