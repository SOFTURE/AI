// A finding of the quality gate (FIRE_TRACKER `src/lib/blog/quality/finding.ts`). An error refuses a
// publish and fails `softure-blog check`; a warning only informs.

export const QUALITY_SEVERITIES = ["error", "warning"] as const;
export type QualitySeverity = (typeof QUALITY_SEVERITIES)[number];

export interface QualityFinding {
  /** The stable id of the rule, used for severity overrides and by the writing skill. */
  readonly rule: string;
  readonly severity: QualitySeverity;
  /** What is wrong and what to do instead, in English. */
  readonly message: string;
  /** The line of the file, from 1, when the rule points at one. */
  readonly line?: number;
}

export function hasQualityErrors(findings: readonly QualityFinding[]): boolean {
  return findings.some((finding) => finding.severity === "error");
}

/** Errors first, then by line; findings without a line go first within their severity. */
export function sortFindings(findings: readonly QualityFinding[]): QualityFinding[] {
  return [...findings].sort((a, b) => (a.severity === b.severity ? (a.line ?? 0) - (b.line ?? 0) : a.severity === "error" ? -1 : 1));
}

/** `[rule] line N: message`, the form the publish command prints. */
export function formatFinding(finding: QualityFinding): string {
  return `[${finding.rule}]${finding.line === undefined ? "" : ` line ${String(finding.line)}`}: ${finding.message}`;
}
