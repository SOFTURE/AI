import { COVERAGE_STATUSES, SECURITY_SCENARIOS, type CoverageEntry, type CoverageStatus, type SecurityScenario } from "./coverage.js";
import { CATEGORY_RULES, FOCUSES, SEVERITIES, getFindingId, type Category, type Finding, type Focus, type Rule, type Severity } from "./findings.js";

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
  /** What the run looked for; a general run leaves it out, so its report is the 0.1 report. */
  focus?: Focus;
  /** The folder the run reported on, and its package name; left out for the whole repository. */
  scope?: { folder: string; packageName: string | null };
  /** The globs findings were limited to; left out when there were none. */
  paths?: string[];
  /** Model round trips of the run; a security run records it as evidence of its depth. */
  turns?: number;
  /** Distinct repository files the agent read; a security run records it as evidence of its depth. */
  filesRead?: number;
  /** One entry per threat scenario of a security run, in the prompt's order. */
  coverage?: CoverageEntry[];
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

function isFocused(header: ReportHeader): boolean {
  return header.focus !== undefined && header.focus !== "general";
}

function formatScope(scope: NonNullable<ReportHeader["scope"]>): string {
  return `\`${scope.folder}\`${scope.packageName === null ? "" : ` (${scope.packageName})`}`;
}

function formatPaths(paths: string[]): string {
  return paths.map((glob) => `\`${glob}\``).join(", ");
}

/** The report's title and opening line; a general whole-repository run keeps the 0.1 text. */
function getIntro(header: ReportHeader): string[] {
  if (!isFocused(header) && header.scope === undefined && header.paths === undefined) {
    return [
      "# Quality report",
      "",
      REPORT_MARKER,
      "",
      "A read-only review of the whole repository at one commit (`@softure-ai/quality-review`). Each run replaces this",
      "file; the format is documented in the package README, \"Report format\".",
    ];
  }
  const kind = isFocused(header) ? `${header.focus ?? ""} review` : "review";
  const what = header.scope === undefined ? "the whole repository" : `${formatScope(header.scope)}`;
  const limited = header.paths === undefined ? "" : `, findings limited to ${formatPaths(header.paths)}`;
  return [
    isFocused(header) ? "# Security report" : "# Quality report",
    "",
    REPORT_MARKER,
    "",
    `A read-only ${kind} of ${what} at one commit${limited} (\`@softure-ai/quality-review\`). Each run replaces this`,
    "file; the format is documented in the package README, \"Report format\".",
  ];
}

/** The optional header rows, only for what the run set. */
function getOptionalRows(header: ReportHeader): string[] {
  const rows: string[] = [];
  if (isFocused(header)) rows.push(`| Focus | ${header.focus ?? ""} |`);
  if (header.scope !== undefined) rows.push(`| Scope | ${formatScope(header.scope)} |`);
  if (header.paths !== undefined) rows.push(`| Paths | ${formatPaths(header.paths)} |`);
  return rows;
}

const COVERAGE_TEXT: Record<CoverageStatus, string> = {
  traced: "traced",
  "no-surface": "no surface",
  "not-covered": "not covered",
};

/** The depth rows a security run adds after the token counts. */
function getDepthRows(header: ReportHeader): string[] {
  const rows: string[] = [];
  if (header.turns !== undefined) rows.push(`| Turns | ${String(header.turns)} |`);
  if (header.filesRead !== undefined) rows.push(`| Files read | ${String(header.filesRead)} |`);
  return rows;
}

/** The coverage section of a security run: every scenario, its status, the files read for it and a note. */
function getCoverageLines(coverage: CoverageEntry[]): string[] {
  const lines = ["## Coverage", ""];
  const missing = coverage.filter((entry) => entry.status === "not-covered").map((entry) => entry.scenario);
  if (missing.length > 0) {
    lines.push(
      `> ${String(missing.length)} of ${String(coverage.length)} threat scenarios were not covered (${missing.join(", ")}): the findings below do not prove those areas clean.`,
      "",
    );
  }
  lines.push("| Scenario | Status | Files | Note |", "| --- | --- | --- | --- |");
  for (const entry of coverage) {
    const files = entry.files.length === 0 ? "-" : entry.files.map((file) => `\`${toCell(file)}\``).join(", ");
    lines.push(`| ${entry.scenario} | ${COVERAGE_TEXT[entry.status]} | ${files} | ${toCell(entry.note)} |`);
  }
  lines.push("");
  return lines;
}

/** Writes the whole report. Nothing from an earlier report is read or kept: each run replaces the file. */
export function renderReport(report: Report): string {
  const { header } = report;
  const findings = sortFindings(report.findings);
  const lines = [
    ...getIntro(header),
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Date | ${header.date} |`,
    `| Commit | \`${header.commit}\` |`,
    ...getOptionalRows(header),
    `| Model | ${header.model} |`,
    `| Cost | ${header.costUsd.toFixed(4)} USD of a ${header.budgetUsd.toFixed(2)} USD budget |`,
    `| Tokens | input ${String(header.tokens.input)}, output ${String(header.tokens.output)}, cache read ${String(header.tokens.cacheRead)}, cache write ${String(header.tokens.cacheWrite)} |`,
    ...getDepthRows(header),
    `| Status | ${STATUS_TEXT[header.status]} |`,
    `| Findings | ${formatCounts(findings)} |`,
    `| Ignored | ${String(header.ignored)} |`,
    "",
  ];
  if (header.status !== "complete") {
    const covered = header.scope === undefined && header.paths === undefined ? "the whole repository" : "everything in its scope";
    lines.push(
      `> The run ${STATUS_TEXT[header.status]} before it covered ${covered}: the findings below are the ones it verified until then, and a clean area is not proven clean.`,
      "",
    );
  }
  if (findings.length === 0 && header.status === "complete") {
    lines.push("No findings: the review found nothing to report at this commit.", "");
  }
  if (header.coverage !== undefined) lines.push(...getCoverageLines(header.coverage));
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

function isScenario(value: string): value is SecurityScenario {
  return (SECURITY_SCENARIOS as readonly string[]).includes(value);
}

/** One row of the coverage table, or null (with the reason in errors) when it is not one. */
function parseCoverageRow(line: string, errors: string[]): CoverageEntry | null {
  const cells = splitRow(line);
  if (cells.length !== 4) {
    errors.push(`a coverage row does not have 4 cells: ${line}`);
    return null;
  }
  const [scenario = "", statusText = "", filesText = "", note = ""] = cells;
  const status = COVERAGE_STATUSES.find((key) => COVERAGE_TEXT[key] === statusText);
  if (!isScenario(scenario)) errors.push(`coverage: unknown scenario "${scenario}"`);
  if (status === undefined) errors.push(`coverage: unknown status "${statusText}" for ${scenario}`);
  if (note === "") errors.push(`coverage: the note of ${scenario} is empty`);
  if (!isScenario(scenario) || status === undefined) return null;
  const files = filesText === "-" ? [] : [...filesText.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? "");
  if (status === "traced" && files.length === 0) errors.push(`coverage: ${scenario} is traced but names no file`);
  return { scenario, status, files, note };
}

/** Checks the coverage table: every scenario once, in any order. */
function checkCoverage(coverage: CoverageEntry[], errors: string[]): void {
  const seen = new Set<string>();
  for (const entry of coverage) {
    if (seen.has(entry.scenario)) errors.push(`coverage: ${entry.scenario} is listed twice`);
    seen.add(entry.scenario);
  }
  for (const scenario of SECURITY_SCENARIOS) if (!seen.has(scenario)) errors.push(`coverage: ${scenario} is missing`);
}

export type ParseResult = { ok: true; report: Report } | { ok: false; errors: string[] };

const HEADER_FIELDS = ["Date", "Commit", "Model", "Cost", "Tokens", "Status", "Findings", "Ignored"] as const;
/** Rows a focused, scoped or path-limited report adds; a general whole-repository report has none of them. */
const OPTIONAL_HEADER_FIELDS = ["Focus", "Scope", "Paths", "Turns", "Files read"] as const;

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
    const known = [...HEADER_FIELDS, ...OPTIONAL_HEADER_FIELDS] as readonly string[];
    if (cells.length === 2 && known.includes(cells[0] ?? "")) values.set(cells[0] ?? "", cells[1] ?? "");
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
  const focus = values.get("Focus");
  if (focus !== undefined && !(FOCUSES as readonly string[]).includes(focus)) errors.push(`header: unknown Focus "${focus}"`);
  const scopeText = values.get("Scope");
  const scope = scopeText === undefined ? undefined : /^`([^`]+)`(?: \((.+)\))?$/.exec(scopeText);
  if (scope === null) errors.push("header: Scope is not \"`<folder>`\" or \"`<folder>` (<package>)\"");
  const pathsText = values.get("Paths");
  const paths = pathsText === undefined ? undefined : [...pathsText.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? "");
  if (paths?.length === 0) errors.push("header: Paths lists no glob");
  const turns = values.get("Turns");
  const filesRead = values.get("Files read");
  if (turns !== undefined && !/^\d+$/.test(turns)) errors.push("header: Turns is not a number");
  if (filesRead !== undefined && !/^\d+$/.test(filesRead)) errors.push("header: Files read is not a number");
  if (cost === null || tokens === null || status === undefined) return null;
  return {
    ...(focus === undefined ? {} : { focus: focus as Focus }),
    ...(scope === undefined || scope === null ? {} : { scope: { folder: scope[1] ?? "", packageName: scope[2] ?? null } }),
    ...(paths === undefined || paths.length === 0 ? {} : { paths }),
    ...(turns === undefined || !/^\d+$/.test(turns) ? {} : { turns: Number(turns) }),
    ...(filesRead === undefined || !/^\d+$/.test(filesRead) ? {} : { filesRead: Number(filesRead) }),
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
  let coverage: CoverageEntry[] | null = null;
  let inCoverage = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (line.startsWith("## ")) {
      const title = line.slice(3).trim();
      section = SEVERITIES.find((severity) => SECTION_TITLES[severity] === title) ?? null;
      inCoverage = title === "Coverage";
      if (inCoverage) {
        if (coverage !== null) errors.push("the Coverage section is listed twice");
        coverage = [];
      } else if (section === null) errors.push(`unknown section "${title}"`);
      else sectionsSeen.add(section);
      continue;
    }
    if (inCoverage && coverage !== null) {
      if (line.startsWith("|") && !line.startsWith("| Scenario |") && !line.startsWith("| ---")) {
        const entry = parseCoverageRow(line, errors);
        if (entry !== null) coverage.push(entry);
      }
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
  if (coverage !== null) checkCoverage(coverage, errors);
  if (errors.length > 0 || header === null) return { ok: false, errors };
  return { ok: true, report: { header: coverage === null ? header : { ...header, coverage }, findings } };
}
