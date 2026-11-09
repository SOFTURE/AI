import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { Finding } from "./findings.js";

export interface VerifiedFindings {
  findings: Finding[];
  /** Findings dropped because their location does not exist, with the reason. */
  dropped: string[];
}

/**
 * The mechanical check after the agent's own: a finding must point at a file inside the repository that has the line
 * it names. What fails is dropped, never reported (the issue: what cannot be confirmed is dropped).
 */
export function verifyLocations(repo: string, findings: Finding[]): VerifiedFindings {
  const root = realpathSync(repo);
  const kept: Finding[] = [];
  const dropped: string[] = [];
  const lineCounts = new Map<string, number>();
  for (const finding of findings) {
    const reason = getLocationProblem(root, finding, lineCounts);
    if (reason === null) kept.push(finding);
    else dropped.push(`${finding.id} ${finding.file}:${String(finding.line)}: ${reason}`);
  }
  return { findings: kept, dropped };
}

function getLocationProblem(root: string, finding: Finding, lineCounts: Map<string, number>): string | null {
  if (isAbsolute(finding.file)) return "the path is absolute";
  const path = resolve(root, finding.file);
  if (!existsSync(path)) return "the file does not exist";
  const real = realpathSync(path);
  const inside = relative(root, real);
  if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) return "the file is outside the repository";
  if (!statSync(real).isFile()) return "the path is not a file";
  let count = lineCounts.get(real);
  if (count === undefined) {
    count = readFileSync(real, "utf8").split("\n").length;
    lineCounts.set(real, count);
  }
  return finding.line <= count ? null : `the file has ${String(count)} lines`;
}
