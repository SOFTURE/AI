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

interface Token {
  text: string;
  isCode: boolean;
}

/**
 * A Markdown line split into inline code spans and the text between them. Code spans quote real paths and slugs from
 * other repositories; they are not prose. A span is a run of backticks, text without backticks and a run of the same
 * length. One pass over the tokens, so a line full of backticks costs linear time (a backreference regex is polynomial).
 */
function splitCodeSpans(line: string): Token[] {
  const parts = line.split(/(`+)/);
  const tokens: Token[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const opener = parts[index] ?? "";
    const closer = parts[index + 2];
    if (opener.startsWith("`") && closer === opener) {
      tokens.push({ text: `${opener}${parts[index + 1] ?? ""}${closer}`, isCode: true });
      index += 2;
    } else {
      tokens.push({ text: opener, isCode: false });
    }
  }
  return tokens;
}

// A verbatim quote in the owner's language, marked in Markdown: `<!-- language: pl -->` … `<!-- /language -->`.
const QUOTE_MARKER = /<!--\s*(?:language:\s*[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})?|(\/)language)\s*-->/g;

interface MarkdownLine {
  /** What the diacritic check reads: the line without its marked quotes. */
  kept: string;
  /** What the word check reads: the kept text without code spans. */
  prose: string;
  isQuoteOpen: boolean;
  /** Whether the region still open at the end of the line was opened on it. */
  isOpenedHere: boolean;
}

/** Removes the marked quotes from a Markdown line; `isQuoteOpen` carries a region across lines. */
function readMarkdownLine(line: string, isQuoteOpenBefore: boolean): MarkdownLine {
  let isQuoteOpen = isQuoteOpenBefore;
  let isOpenedHere = false;
  let kept = "";
  let prose = "";
  for (const token of splitCodeSpans(line)) {
    if (token.isCode) {
      if (!isQuoteOpen) {
        kept += token.text;
        prose += " ";
      }
      continue;
    }
    let from = 0;
    for (const marker of token.text.matchAll(QUOTE_MARKER)) {
      const isClosing = marker[1] !== undefined;
      if (!isQuoteOpen) {
        const before = token.text.slice(from, marker.index);
        kept += before;
        prose += before;
      }
      // A closing marker with nothing open is ignored.
      if (isQuoteOpen || !isClosing) {
        isQuoteOpen = !isClosing;
        isOpenedHere = isQuoteOpen;
      }
      from = marker.index + marker[0].length;
      kept += " ";
      prose += " ";
    }
    if (!isQuoteOpen) {
      const rest = token.text.slice(from);
      kept += rest;
      prose += rest;
    }
  }
  return { kept, prose, isQuoteOpen, isOpenedHere };
}

/**
 * Lines of `text` that contain Polish, the first reason per line. In Markdown, code spans are skipped by the word
 * check and a quote marked with `<!-- language: xx -->` … `<!-- /language -->` is skipped entirely.
 */
export function findPolishText(path: string, text: string): LineHit[] {
  if (text.includes("\0")) return [];
  const isMarkdown = path.toLowerCase().endsWith(".md");
  const hits: LineHit[] = [];
  let isQuoteOpen = false;
  let quoteOpenedOn = 0;
  text.split("\n").forEach((rawLine, index) => {
    let kept = rawLine;
    let prose = rawLine;
    if (isMarkdown) {
      let isOpenedHere;
      ({ kept, prose, isQuoteOpen, isOpenedHere } = readMarkdownLine(rawLine, isQuoteOpen));
      if (isOpenedHere) quoteOpenedOn = index + 1;
    }
    const diacritic = POLISH_DIACRITIC.exec(kept);
    if (diacritic) {
      hits.push({ line: index + 1, reason: `Polish diacritic "${diacritic[0]}"` });
      return;
    }
    const word = POLISH_WORD.exec(prose);
    if (word?.[1]) hits.push({ line: index + 1, reason: `Polish word "${word[1].toLowerCase()}"` });
  });
  if (isQuoteOpen) {
    return [...hits, { line: quoteOpenedOn, reason: "unclosed language marker" }].sort((a, b) => a.line - b.line);
  }
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
