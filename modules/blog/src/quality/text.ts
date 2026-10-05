// Text helpers of the gate (FIRE_TRACKER `src/lib/blog/quality/text.ts`): prose without markup, words,
// sentences, links, footnote references and the numbers that need a source. Number notation comes
// from the language ruleset, so "28 260,50" and "28,260.50" both read as one number.

export interface MarkdownLink {
  readonly text: string;
  readonly url: string;
}

/** How a language writes numbers, and which numbers count as facts that need a source. */
export interface NumberNotation {
  /** A number token; global. */
  readonly number: RegExp;
  /** A unit right after the number (`%`, a currency, "million"); tested on the text that follows. */
  readonly unitAfter: RegExp;
  /** A unit right before the number (`$`); tested on the text before. `null`: none. */
  readonly unitBefore: RegExp | null;
  /** A legal or list reference before the number ("art.", "§", "no."), which needs no source. */
  readonly referenceBefore: RegExp;
  /** The digits to remove before reading the number (thousands separators). */
  readonly thousandsSeparator: RegExp;
  readonly decimalSeparator: "," | ".";
}

// No `[` inside link text, link target or footnote id: each match attempt ends at the next `[`, so a
// long run of unclosed brackets stays linear instead of rescanning the rest of the text per bracket.
// An image (`![alt](src)`) is not a link: the lookbehind skips it, and `IMAGE` removes it from prose.
const LINK = /(?<!!)\[([^[\]]*)\]\(([^)\s[]+)(?:\s+"[^"]*")?\)/g;
const IMAGE = /!\[[^[\]]*\]\([^)\s[]+(?:\s+"[^"]*")?\)/g;
const FOOTNOTE_REF = /\[\^([^[\]]+)\]/g;
const URL_IN_TEXT = /https?:\/\/[^\s)>\]]+/g;

export function findLinks(text: string): MarkdownLink[] {
  return [...text.matchAll(LINK)].map((match) => ({ text: match[1] ?? "", url: match[2] ?? "" }));
}

export function findFootnoteRefs(text: string): string[] {
  return [...text.matchAll(FOOTNOTE_REF)].map((match) => match[1] ?? "");
}

/** Bare URLs in a text (a footnote definition), without trailing punctuation. */
export function findBareUrls(text: string): string[] {
  return [...text.matchAll(URL_IN_TEXT)].map((match) => match[0].replace(/[.,;]$/, ""));
}

/** The prose a reader sees: no code, images, link targets, footnote refs, URLs or emphasis markers. */
export function toProse(text: string): string {
  return text
    .replace(/`[^`]*`/g, " ")
    .replace(IMAGE, " ")
    .replace(LINK, "$1")
    .replace(FOOTNOTE_REF, "")
    .replace(/<https?:\/\/[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\*\*|__/g, "")
    .replace(/(?<![\p{L}\d])[*_](?=\S)|(?<=\S)[*_](?![\p{L}\d])/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(prose: string): number {
  return prose.match(/[\p{L}\d][\p{L}\d'’-]*/gu)?.length ?? 0;
}

/**
 * Sentences of prose. A boundary is `.`, `!`, `?` or `…` before an upper-case letter, a quote or a
 * bracket, never before a digit, so "art. 27" and "approx. 300" do not cut a sentence.
 */
export function splitSentences(prose: string): string[] {
  return prose
    .split(/(?<=[.!?…])\s+(?=[\p{Lu}„“"(])/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * The numbers that need a source: amounts, percentages and numbers from 1000 up. Ages, years
 * (1900–2100), small counts and legal references ("art. 27") need none, or every text about law
 * would fail.
 */
export function findSignificantNumbers(prose: string, notation: NumberNotation): string[] {
  const found: string[] = [];
  for (const match of prose.matchAll(new RegExp(notation.number.source, "g"))) {
    const raw = match[0];
    const before = prose.slice(Math.max(0, match.index - 12), match.index);
    const after = prose.slice(match.index + raw.length, match.index + raw.length + 12);
    if (/[\p{L}\d]$/u.test(before) || notation.referenceBefore.test(before)) continue;
    if (notation.unitAfter.test(after) || (notation.unitBefore?.test(before) ?? false)) {
      found.push(raw);
      continue;
    }
    const value = parseNumber(raw, notation);
    const looksLikeYear = /^\d{4}$/.test(raw) && value >= 1900 && value <= 2100;
    if (value >= 1000 && !looksLikeYear) found.push(raw);
  }
  return found;
}

/** "28 260,50" (pl) or "28,260.50" (en) → 28260.5. */
export function parseNumber(raw: string, notation: NumberNotation): number {
  const digits = raw.replace(new RegExp(notation.thousandsSeparator.source, "g"), "");
  return Number(notation.decimalSeparator === "," ? digits.replace(",", ".") : digits);
}

/** A number without thousands separators, to compare a text with a table. */
export function normalizeNumber(raw: string, notation: NumberNotation): string {
  return raw.replace(new RegExp(notation.thousandsSeparator.source, "g"), "");
}

/** A case-insensitive pattern with word edges that know non-ASCII letters (`\b` knows only ASCII). */
export function wordPattern(source: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\d])(?:${source})(?![\\p{L}\\d])`, "giu");
}
