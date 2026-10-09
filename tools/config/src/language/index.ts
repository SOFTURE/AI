// Language gate: finds Polish text outside message dictionaries ("English only in code", the rule
// `@softure-ai/skills` installs). Pure functions; `softure-check-language` reads the files.
import { POLISH_DIACRITIC, POLISH_WORDS } from "./pl/polish.js";

export interface LineHit {
  line: number;
  reason: string;
}

export interface FileHit extends LineHit {
  path: string;
}

/** Reads a repo-relative path; null when it is missing or not a file (deleted, renamed, a folder). */
export type ReadText = (path: string) => string | null;

// A word counts only when it stands alone: not glued to letters or digits, and not part of a
// path, slug, identifier, hash or file name (`nie-pamietam-hasla`, `a/nie/b`, `x+nie=`).
const POLISH_WORD = new RegExp(
  `(?<![\\p{L}\\p{N}_\\-/.+=])(${POLISH_WORDS.join("|")})(?![\\p{L}\\p{N}_\\-/.+=])`,
  "iu",
);

// Generated lockfiles hold base64 hashes, not prose.
const EXEMPT_FILE_NAMES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);
// User-facing copy (`messages/`) and Polish language data kept apart in a folder named after the
// locale (`pl/`: a text ruleset's word lists, Polish test articles, this gate's own word list).
const EXEMPT_FOLDERS = ["messages", "pl"];

const SCISSORS = "# ------------------------ >8 ------------------------";

/** Whether a repo-relative path may contain Polish. */
export function isExempt(path: string): boolean {
  const segments = path.replaceAll("\\", "/").split("/");
  const fileName = segments.at(-1) ?? "";
  return EXEMPT_FILE_NAMES.has(fileName) || segments.slice(0, -1).some((folder) => EXEMPT_FOLDERS.includes(folder));
}

/**
 * Markdown inline code spans quote real paths and slugs from other repositories; they are not prose.
 * A span is a run of backticks, text without backticks and a run of the same length. One pass over
 * the tokens, so a line full of backticks costs linear time (a backreference regex is polynomial).
 */
function removeCodeSpans(line: string): string {
  const tokens = line.split(/(`+)/);
  const kept: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const opener = tokens[index] ?? "";
    const closer = tokens[index + 2];
    if (opener.startsWith("`") && closer === opener) {
      kept.push(" ");
      index += 2;
    } else {
      kept.push(opener);
    }
  }
  return kept.join("");
}

/** Lines of `text` that contain Polish, the first reason per line. `path` decides whether Markdown code spans are skipped. */
export function findPolishText(path: string, text: string): LineHit[] {
  if (text.includes("\0")) return [];
  const isMarkdown = path.toLowerCase().endsWith(".md");
  const hits: LineHit[] = [];
  text.split("\n").forEach((rawLine, index) => {
    const diacritic = POLISH_DIACRITIC.exec(rawLine);
    if (diacritic) {
      hits.push({ line: index + 1, reason: `Polish diacritic "${diacritic[0]}"` });
      return;
    }
    const word = POLISH_WORD.exec(isMarkdown ? removeCodeSpans(rawLine) : rawLine);
    if (word?.[1]) hits.push({ line: index + 1, reason: `Polish word "${word[1].toLowerCase()}"` });
  });
  return hits;
}

/** Every hit in `paths` outside exempt paths; unreadable files are skipped. */
export function checkFiles(paths: readonly string[], readText: ReadText): FileHit[] {
  return paths
    .filter((path) => !isExempt(path))
    .flatMap((path) => {
      const text = readText(path);
      return text === null ? [] : findPolishText(path, text).map((hit) => ({ path, ...hit }));
    });
}

/**
 * The message part of a commit message file: git's comment lines and, with `git commit -v`,
 * everything below the scissors line (the diff, which may touch message dictionaries) removed.
 */
export function getCommitMessageText(raw: string): string {
  const [message = ""] = raw.split(SCISSORS);
  return message
    .split("\n")
    .map((line) => (line.startsWith("#") ? "" : line))
    .join("\n");
}

/** The report printed for a failed gate: one `path:line: reason` per hit, then the rule. */
export function formatHits(hits: readonly FileHit[]): string {
  const lines = hits.map((hit) => `${hit.path}:${hit.line}: ${hit.reason}`);
  return [
    ...lines,
    "",
    `Language gate: ${hits.length} line(s) with Polish text. Code, comments, docs and commits are English; ` +
      "Polish copy belongs in messages/ dictionaries, Polish language data in a pl/ folder (AGENTS.md).",
  ].join("\n");
}
