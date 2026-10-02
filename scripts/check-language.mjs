// @ts-check
// Language gate: fails on Polish text outside message dictionaries (AGENTS.md, "English only in code").
//
//   node scripts/check-language.mjs <file>...   check these files (the pre-commit hook passes staged files)
//   node scripts/check-language.mjs --all       check every file git tracks
//
// Exit code 0: clean. Exit code 1: at least one hit, each printed as `path:line: reason`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIACRITIC = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u;

// Common Polish words that are not English words, so English prose never trips them. Polish
// written without diacritics is caught here; with diacritics, DIACRITIC catches it first.
const POLISH_WORDS = [
  "albo", "bedzie", "bez", "blad", "czy", "czyli", "dla", "dlaczego", "dodaj", "dziala", "gdy",
  "gdzie", "haslo", "jako", "jesli", "jeszcze", "jest", "juz", "kiedy", "ktora", "ktore", "ktory",
  "mozna", "moze", "nalezy", "nie", "nigdy", "oraz", "plik", "pliku", "poniewaz", "potem", "przez",
  "sie", "sobie", "sprawdz", "tego", "teraz", "trzeba", "tutaj", "tylko", "usun", "uzytkownik",
  "wiec", "wszystko", "zawsze", "zeby", "zmiana", "zmianka", "zrobic",
];

// A word counts only when it stands alone: not glued to letters or digits, and not part of a
// path, slug, identifier, hash or file name (`nie-pamietam-hasla`, `a/nie/b`, `x+nie=`).
const WORD = new RegExp(
  `(?<![\\p{L}\\p{N}_\\-/.+=])(${POLISH_WORDS.join("|")})(?![\\p{L}\\p{N}_\\-/.+=])`,
  "iu",
);

// Files allowed to hold Polish: message dictionaries (user-facing copy), the gate and its test
// (they must spell the words), and the generated lockfile (base64 hashes, no prose).
const EXEMPT_FILES = new Set(["scripts/check-language.mjs", "tests/repo/language.test.ts", "package-lock.json"]);

/**
 * @typedef {{ line: number, reason: string }} LineHit
 * @typedef {{ path: string, line: number, reason: string }} FileHit
 */

/**
 * Whether a repo-relative path may contain Polish.
 * @param {string} path
 * @returns {boolean}
 */
export function isExempt(path) {
  const normalized = path.replaceAll("\\", "/");
  return EXEMPT_FILES.has(normalized) || normalized.split("/").slice(0, -1).includes("messages");
}

/**
 * Markdown inline code spans quote real paths and slugs from other repositories; they are not prose.
 * @param {string} line
 * @returns {string}
 */
function removeCodeSpans(line) {
  return line.replace(/(`+)[^`]*?\1/g, " ");
}

/**
 * Lines of `text` that contain Polish, first reason per line.
 * @param {string} path repo-relative path; decides whether Markdown code spans are skipped
 * @param {string} text file contents
 * @returns {LineHit[]}
 */
export function findPolishText(path, text) {
  if (text.includes("\0")) return [];
  const isMarkdown = path.toLowerCase().endsWith(".md");
  /** @type {LineHit[]} */
  const hits = [];
  text.split("\n").forEach((rawLine, index) => {
    const diacritic = DIACRITIC.exec(rawLine);
    if (diacritic) {
      hits.push({ line: index + 1, reason: `Polish diacritic "${diacritic[0]}"` });
      return;
    }
    const word = WORD.exec(isMarkdown ? removeCodeSpans(rawLine) : rawLine);
    if (word?.[1]) hits.push({ line: index + 1, reason: `Polish word "${word[1].toLowerCase()}"` });
  });
  return hits;
}

/**
 * Reads a file as UTF-8, or returns null when it is missing or not a file.
 * @param {string} absolutePath
 * @returns {string | null}
 */
function readTextOrNull(absolutePath) {
  try {
    return readFileSync(absolutePath, "utf8");
  } catch {
    // Deleted, renamed or a folder: there is nothing to check.
    return null;
  }
}

/**
 * Checks files and returns every hit outside exempt paths.
 * @param {string[]} paths repo-relative paths
 * @param {(path: string) => string | null} [readFile] defaults to reading from `root`
 * @param {string} [root] base folder for the default reader
 * @returns {FileHit[]}
 */
export function checkFiles(paths, readFile, root = process.cwd()) {
  const read = readFile ?? ((path) => readTextOrNull(resolve(root, path)));
  return paths
    .filter((path) => !isExempt(path))
    .flatMap((path) => {
      const text = read(path);
      return text === null ? [] : findPolishText(path, text).map((hit) => ({ path, ...hit }));
    });
}

/** @returns {string[]} */
function listTrackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((path) => path.length > 0);
}

/** @param {string[]} args */
function runCli(args) {
  const paths = args.includes("--all") ? listTrackedFiles() : args;
  const hits = checkFiles(paths);
  for (const hit of hits) console.error(`${hit.path}:${hit.line}: ${hit.reason}`);
  if (hits.length > 0) {
    console.error(
      `\nLanguage gate: ${hits.length} line(s) with Polish text. Code, comments, docs and commits are ` +
        "English; Polish copy belongs in messages/ dictionaries (AGENTS.md).",
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2));
}
