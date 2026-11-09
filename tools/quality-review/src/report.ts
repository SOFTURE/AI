import { CATEGORY_RULES, SEVERITIES, getFindingId, type Category, type Finding, type Rule, type Severity } from "./findings.js";

/** The report format version, written into every report and checked by the parser. */
export const REPORT_FORMAT = 1;
export const REPORT_MARKER = `<!-- softure-quality-review format ${String(REPORT_FORMAT)} -->`;
export const DEFAULT_REPORT_PATH = "QUALITY-REPORT.md";

/** How the run ended. A stopped run still reports the findings verified before the stop. */
export type RunStatus = "complete" | "budget" | "turns";

const STATUS_TEXT: Record<RunStatus, string> = {
  complete: "complete",
  budget: "stopped at the budget",
  turns: "stopped at the turn limit",
};

export interface TokenCounts {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ReportHeader {
  /** ISO 8601 time of the run, UTC. */
  date: string;
  commit: string;
  model: string;
  costUsd: number;
  budgetUsd: number;
  tokens: TokenCounts;
  status: RunStatus;
  /** Findings an accepted exception covered. */
  ignored: number;
}

export interface Report {
  header: ReportHeader;
  findings: Finding[];
}

const SECTION_TITLES: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warnings",
  suggestion: "Suggestions",
};

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, suggestion: 2 };

/** Critical first, then warnings, then suggestions; within one severity by file and line. */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.id.localeCompare(b.id),
  );
}

function toOneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function toCell(text: string): string {
  return toOneLine(text).replaceAll("|", "\\|");
}

function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, warning: 0, suggestion: 0 };
  for (const finding of findings) counts[finding.severity]++;
  return counts;
}

function formatCounts(findings: Finding[]): string {
  const counts = countBySeverity(findings);
  return SEVERITIES.map((severity) => `${String(counts[severity])} ${severity}`).join(", ");
}

/** Writes the whole report. Nothing from an earlier report is read or kept: each run replaces the file. */
export function renderReport(report: Report): string {
  const { header } = report;
  const findings = sortFindings(report.findings);
  const lines = [
    "# Quality report",
    "",
    REPORT_MARKER,
    "",
    "A read-only review of the whole repository at one commit (`@softure-ai/quality-review`). Each run replaces this",
    "file; the format is documented in the package README, \"Report format\".",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Date | ${header.date} |`,
    `| Commit | \`${header.commit}\` |`,
    `| Model | ${header.model} |`,
    `| Cost | ${header.costUsd.toFixed(4)} USD of a ${header.budgetUsd.toFixed(2)} USD budget |`,
    `| Tokens | input ${String(header.tokens.input)}, output ${String(header.tokens.output)}, cache read ${String(header.tokens.cacheRead)}, cache write ${String(header.tokens.cacheWrite)} |`,
    `| Status | ${STATUS_TEXT[header.status]} |`,
    `| Findings | ${formatCounts(findings)} |`,
    `| Ignored | ${String(header.ignored)} |`,
    "",
  ];
  if (header.status !== "complete") {
    lines.push(
      `> The run ${STATUS_TEXT[header.status]} before it covered the whole repository: the findings below are the ones it verified until then, and a clean area is not proven clean.`,
      "",
    );
  }
  if (findings.length === 0 && header.status === "complete") {
    lines.push("No findings: the review found nothing to report at this commit.", "");
  }
  for (const severity of ["critical", "warning"] as const) {
    lines.push(`## ${SECTION_TITLES[severity]}`, "");
    const section = findings.filter((finding) => finding.severity === severity);
    if (section.length === 0) lines.push("None.", "");
    for (const finding of section) {
      lines.push(
        `### ${finding.id}: ${toOneLine(finding.title)}`,
        "",
        `- Severity: ${finding.severity}`,
        `- Category: ${finding.category}`,
        `- Rule: ${finding.rule}`,
        `- Location: \`${finding.file}:${String(finding.line)}\``,
        `- Symbol: ${finding.symbol.trim() === "" ? "-" : `\`${toOneLine(finding.symbol)}\``}`,
        `- Problem: ${toOneLine(finding.problem)}`,
        `- Impact: ${toOneLine(finding.impact)}`,
        `- Fix: ${toOneLine(finding.fix)}`,
        "",
      );
    }
  }
  lines.push(`## ${SECTION_TITLES.suggestion}`, "");
  const minor = findings.filter((finding) => finding.severity === "suggestion");
  if (minor.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push(
      "| ID | Category | Rule | Location | Symbol | Title | Problem | Impact | Fix |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const finding of minor) {
      lines.push(
        `| ${finding.id} | ${finding.category} | ${finding.rule} | \`${finding.file}:${String(finding.line)}\` | ${finding.symbol.trim() === "" ? "-" : `\`${toCell(finding.symbol)}\``} | ${toCell(finding.title)} | ${toCell(finding.problem)} | ${toCell(finding.impact)} | ${toCell(finding.fix)} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

export type ParseResult = { ok: true; report: Report } | { ok: false; errors: string[] };

const HEADER_FIELDS = ["Date", "Commit", "Model", "Cost", "Tokens", "Status", "Findings", "Ignored"] as const;

function splitRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replaceAll("\\|", "|"));
}

function unquote(text: string): string {
  return text.replace(/^`(.*)`$/, "$1");
}

function parseLocation(text: string): { file: string; line: number } | null {
  const match = /^`?(.+):(\d+)`?$/.exec(text.trim());
  return match?.[1] !== undefined && match[2] !== undefined ? { file: match[1], line: Number(match[2]) } : null;
}

function isCategory(value: string): value is Category {
  return value in CATEGORY_RULES;
}

function toFinding(
  fields: Record<string, string>,
  severity: Severity,
  id: string,
  title: string,
  errors: string[],
): Finding | null {
  const where = id;
  const category = fields.category ?? "";
  const rule = fields.rule ?? "";
  const location = parseLocation(fields.location ?? "");
  if (!isCategory(category)) errors.push(`${where}: unknown category "${category}"`);
  else if (!(CATEGORY_RULES[category] as readonly string[]).includes(rule)) errors.push(`${where}: rule "${rule}" is not a rule of ${category}`);
  if (location === null) errors.push(`${where}: location is not file:line`);
  for (const key of ["problem", "impact", "fix"]) {
    if ((fields[key] ?? "") === "") errors.push(`${where}: ${key} is empty`);
  }
  if (title === "") errors.push(`${where}: title is empty`);
  if (!isCategory(category) || location === null) return null;
  const symbol = fields.symbol === "-" ? "" : unquote(fields.symbol ?? "");
  const finding: Finding = {
    id,
    severity,
    category,
    rule: rule as Rule,
    file: location.file,
    line: location.line,
    symbol,
    title,
    problem: fields.problem ?? "",
    impact: fields.impact ?? "",
    fix: fields.fix ?? "",
  };
  if (getFindingId(finding) !== id) errors.push(`${where}: the id is not the one its rule, file and symbol give (${getFindingId(finding)})`);
  return finding;
}

function parseHeader(lines: string[], errors: string[]): ReportHeader | null {
  const values = new Map<string, string>();
  for (const line of lines) {
    const cells = splitRow(line);
    if (cells.length === 2 && (HEADER_FIELDS as readonly string[]).includes(cells[0] ?? "")) values.set(cells[0] ?? "", cells[1] ?? "");
  }
  for (const field of HEADER_FIELDS) if (!values.has(field)) errors.push(`header: ${field} is missing`);
  const cost = /^([\d.]+) USD of a ([\d.]+) USD budget$/.exec(values.get("Cost") ?? "");
  const tokens = /^input (\d+), output (\d+), cache read (\d+), cache write (\d+)$/.exec(values.get("Tokens") ?? "");
  const status = (Object.keys(STATUS_TEXT) as RunStatus[]).find((key) => STATUS_TEXT[key] === values.get("Status"));
  const date = values.get("Date") ?? "";
  if (values.has("Cost") && cost === null) errors.push("header: Cost is not \"<n> USD of a <n> USD budget\"");
  if (values.has("Tokens") && tokens === null) errors.push("header: Tokens is not \"input <n>, output <n>, cache read <n>, cache write <n>\"");
  if (values.has("Status") && status === undefined) errors.push(`header: unknown Status "${values.get("Status") ?? ""}"`);
  if (values.has("Date") && Number.isNaN(Date.parse(date))) errors.push("header: Date is not a date");
  if (!/^\d+$/.test(values.get("Ignored") ?? "")) errors.push("header: Ignored is not a number");
  if (cost === null || tokens === null || status === undefined) return null;
  return {
    date,
    commit: unquote(values.get("Commit") ?? ""),
    model: values.get("Model") ?? "",
    costUsd: Number(cost[1]),
    budgetUsd: Number(cost[2]),
    tokens: { input: Number(tokens[1]), output: Number(tokens[2]), cacheRead: Number(tokens[3]), cacheWrite: Number(tokens[4]) },
    status,
    ignored: Number(values.get("Ignored")),
  };
}

/**
 * Reads a QUALITY-REPORT.md back and checks it against the format: the marker, the header, every finding's fields,
 * its id (recomputed), its section matching its severity, and the header's counts. A session uses it (`softure-quality-review
 * check`) before it turns findings into work.
 */
export function parseReport(markdown: string): ParseResult {
  const errors: string[] = [];
  const lines = markdown.split("\n");
  if (!lines.some((line) => line.trim() === REPORT_MARKER)) {
    return { ok: false, errors: [`the format marker ${REPORT_MARKER} is missing`] };
  }
  const firstSection = lines.findIndex((line) => line.startsWith("## "));
  const header = parseHeader(lines.slice(0, firstSection === -1 ? undefined : firstSection), errors);
  const findings: Finding[] = [];
  const seen = new Set<string>();
  let section: Severity | null = null;
  const sectionsSeen = new Set<Severity>();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (line.startsWith("## ")) {
      const title = line.slice(3).trim();
      section = SEVERITIES.find((severity) => SECTION_TITLES[severity] === title) ?? null;
      if (section === null) errors.push(`unknown section "${title}"`);
      else sectionsSeen.add(section);
      continue;
    }
    if (section === null) continue;
    const heading = /^### (QR-[0-9a-f]{8}): (.*)$/.exec(line);
    if (heading !== null && section !== "suggestion") {
      const fields: Record<string, string> = {};
      for (index++; index < lines.length && !(lines[index] ?? "").startsWith("#"); index++) {
        const field = /^- (\w+): (.*)$/.exec(lines[index] ?? "");
        if (field?.[1] !== undefined) fields[field[1].toLowerCase()] = field[2] ?? "";
      }
      index--;
      const id = heading[1] ?? "";
      if (fields.severity !== section) errors.push(`${id}: severity "${fields.severity ?? ""}" in the ${SECTION_TITLES[section]} section`);
      const finding = toFinding(fields, section, id, heading[2]?.trim() ?? "", errors);
      if (finding !== null) findings.push(finding);
      continue;
    }
    if (line.startsWith("### ")) {
      errors.push(`a finding heading is not "### QR-<8 hex>: <title>": ${line}`);
      continue;
    }
    if (section === "suggestion" && /^\| QR-/.test(line)) {
      const cells = splitRow(line);
      if (cells.length !== 9) {
        errors.push(`a suggestion row does not have 9 cells: ${line}`);
        continue;
      }
      const [id = "", category = "", rule = "", location = "", symbol = "", title = "", problem = "", impact = "", fix = ""] = cells;
      if (!/^QR-[0-9a-f]{8}$/.test(id)) errors.push(`a suggestion id is not QR-<8 hex>: ${id}`);
      const finding = toFinding({ category, rule, location, symbol, problem, impact, fix }, "suggestion", id, title, errors);
      if (finding !== null) findings.push(finding);
    }
  }
  for (const severity of SEVERITIES) if (!sectionsSeen.has(severity)) errors.push(`the ${SECTION_TITLES[severity]} section is missing`);
  for (const finding of findings) {
    if (seen.has(finding.id)) errors.push(`${finding.id}: listed twice`);
    seen.add(finding.id);
  }
  const countsText = /\| Findings \| (.*) \|/.exec(markdown)?.[1];
  if (countsText !== undefined && countsText !== formatCounts(findings)) {
    errors.push(`header: Findings says "${countsText}", the report lists "${formatCounts(findings)}"`);
  }
  if (errors.length > 0 || header === null) return { ok: false, errors };
  return { ok: true, report: { header, findings } };
}
