import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RULES, normalizePath, type Finding, type Rule } from "./findings.js";

/** The file of accepted exceptions at the repository root. */
export const IGNORE_FILE = "quality-review.ignore";
/** The heading of the same list inside AGENTS.md. */
export const AGENTS_SECTION = "Quality review exceptions";

/** One accepted exception: a finding id, a rule (optionally under a path glob), or a path glob. */
export type IgnoreRule =
  | { kind: "id"; id: string; source: string }
  | { kind: "rule"; rule: Rule; glob: string | null; source: string }
  | { kind: "path"; glob: string; source: string };

export interface IgnoreRules {
  rules: IgnoreRule[];
  /** Lines that are none of the three forms, with where they are. */
  invalid: string[];
}

/**
 * Parses the exception lines. Each line, after `#` comments are cut: `QR-1a2b3c4d`, `rule <rule> [<glob>]` or
 * `path <glob>`. A bullet (`- `) and backticks are allowed, so the same lines work in a Markdown list.
 */
export function parseIgnoreLines(text: string, source: string): IgnoreRules {
  const rules: IgnoreRule[] = [];
  const invalid: string[] = [];
  text.split("\n").forEach((rawLine, index) => {
    const hash = rawLine.indexOf("#");
    const withoutComment = (hash === -1 ? rawLine : rawLine.slice(0, hash)).trim();
    const line = (/^[-*]\s/.test(withoutComment) ? withoutComment.slice(2) : withoutComment).replaceAll("`", "").trim();
    if (line === "") return;
    const where = `${source}:${String(index + 1)}`;
    const [head = "", ...rest] = line.split(/\s+/);
    if (/^QR-[0-9a-f]{8}$/.test(head) && rest.length === 0) {
      rules.push({ kind: "id", id: head, source: where });
    } else if (head === "rule" && isRule(rest[0]) && rest.length <= 2) {
      rules.push({ kind: "rule", rule: rest[0], glob: rest[1] ?? null, source: where });
    } else if (head === "path" && rest.length === 1 && rest[0] !== undefined) {
      rules.push({ kind: "path", glob: rest[0], source: where });
    } else {
      invalid.push(`${where}: ${line}`);
    }
  });
  return { rules, invalid };
}

function isRule(value: string | undefined): value is Rule {
  return value !== undefined && (RULES as string[]).includes(value);
}

/**
 * The list under `## Quality review exceptions` in AGENTS.md, up to the next heading of the same or a higher level.
 * The lines before it are kept blank, so a line number in the section is its line number in AGENTS.md.
 */
export function getAgentsSection(agents: string): string {
  const lines = agents.split("\n");
  const start = lines.findIndex((line) => new RegExp(`^##\\s+${AGENTS_SECTION}\\s*$`, "i").test(line));
  if (start === -1) return "";
  const end = lines.findIndex((line, index) => index > start && /^#{1,2}\s/.test(line));
  return [...lines.slice(0, start + 1).map(() => ""), ...lines.slice(start + 1, end === -1 ? undefined : end)].join("\n");
}

/** Reads quality-review.ignore and the AGENTS.md section of a repository; both are optional. */
export function readIgnoreRules(repo: string): IgnoreRules {
  const result: IgnoreRules = { rules: [], invalid: [] };
  const file = join(repo, IGNORE_FILE);
  if (existsSync(file)) {
    const parsed = parseIgnoreLines(readFileSync(file, "utf8"), IGNORE_FILE);
    result.rules.push(...parsed.rules);
    result.invalid.push(...parsed.invalid);
  }
  const agents = join(repo, "AGENTS.md");
  if (existsSync(agents)) {
    const section = getAgentsSection(readFileSync(agents, "utf8"));
    const parsed = parseIgnoreLines(section, `AGENTS.md (${AGENTS_SECTION})`);
    result.rules.push(...parsed.rules);
    result.invalid.push(...parsed.invalid);
  }
  return result;
}

/** A glob over repository paths: `**` any folders, `*` within one segment, `?` one character. */
export function matchesGlob(path: string, glob: string): boolean {
  let pattern = "";
  const source = normalizePath(glob);
  for (let index = 0; index < source.length; index++) {
    const char = source[index] ?? "";
    if (char === "*" && source[index + 1] === "*") {
      const slash = source[index + 2] === "/";
      pattern += slash ? "(?:.*/)?" : ".*";
      index += slash ? 2 : 1;
    } else if (char === "*") {
      pattern += "[^/]*";
    } else if (char === "?") {
      pattern += "[^/]";
    } else {
      pattern += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${pattern}$`).test(normalizePath(path));
}

/** Whether an exception covers a finding. */
export function isIgnored(finding: Finding, rule: IgnoreRule): boolean {
  switch (rule.kind) {
    case "id":
      return finding.id === rule.id;
    case "rule":
      return finding.rule === rule.rule && (rule.glob === null || matchesGlob(finding.file, rule.glob));
    case "path":
      return matchesGlob(finding.file, rule.glob);
  }
}

export interface FilteredFindings {
  findings: Finding[];
  ignored: Finding[];
}

/** Splits the findings into the reported ones and the ones an accepted exception covers. */
export function applyIgnoreRules(findings: Finding[], rules: IgnoreRule[]): FilteredFindings {
  const kept: Finding[] = [];
  const ignored: Finding[] = [];
  for (const finding of findings) {
    (rules.some((rule) => isIgnored(finding, rule)) ? ignored : kept).push(finding);
  }
  return { findings: kept, ignored };
}
