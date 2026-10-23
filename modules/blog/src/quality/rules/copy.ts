// Rules only copy that is not an article gets (`checkCopyText`): a dash as a pivot, asides stacked in a
// short post, and in `channel` mode the markdown a plain-text editor shows as literal characters.
import { getProseBlocks, type Block } from "../blocks.js";
import type { QualityFinding } from "../finding.js";
import { countWords, toProse } from "../text.js";
import { countWordedAsides } from "./style.js";

/** A post up to this many words is short: three worded asides in it read as a template. */
export const SHORT_POST_WORDS = 300;

const SPACED_DASH = /(\S+)\s([—–])\s(\S+)/gu;

/** A spaced em or en dash between words; a dash next to a number is a range ("2020 – 2024"). */
export function checkDashPivots(blocks: readonly Block[]): QualityFinding[] {
  const findings: QualityFinding[] = [];
  for (const block of getProseBlocks(blocks)) {
    const pivot = [...toProse(block.text).matchAll(SPACED_DASH)].find((match) => !/\d$/.test(match[1] ?? "") && !/^\d/.test(match[3] ?? ""));
    if (pivot === undefined) continue;
    const sample = `${(pivot[1] ?? "").replace(/[.,;:!?]+$/, "")} ${pivot[2] ?? ""} ${(pivot[3] ?? "").replace(/[.,;:!?]+$/, "")}`;
    findings.push({ rule: "dash-pivot", severity: "error", message: `"${sample}": a dash as a pivot between two thoughts; use a full stop, a comma or a colon`, line: block.line });
  }
  return findings;
}

/** Three or more worded asides in a short post, even one per sentence. */
export function checkPostAsides(blocks: readonly Block[]): QualityFinding[] {
  const prose = getProseBlocks(blocks)
    .filter((block) => block.kind !== "heading" && block.kind !== "table")
    .map((block) => toProse(block.text));
  const words = prose.reduce((sum, text) => sum + countWords(text), 0);
  const asides = prose.reduce((sum, text) => sum + countWordedAsides(text), 0);
  if (asides < 3 || words > SHORT_POST_WORDS) return [];
  return [
    {
      rule: "stacked-asides",
      severity: "error",
      message: `${String(asides)} worded asides in parentheses in a post of ${String(words)} words; keep at most two, and fold the rest into sentences`,
    },
  ];
}

interface Markup {
  readonly kind: string;
  /** Matched on the line, after list markers, links, images, code spans and URLs are taken out where noted. */
  readonly pattern: RegExp;
  readonly on: "raw" | "text";
}

const FENCE = /^\s*(?:```|~~~)/;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
const IMAGE = /!\[[^[\]]*\]\([^)\s]*(?:\s+"[^"]*")?\)/g;
const LINK = /(?<!!)\[[^[\]]+\]\([^)\s]+(?:\s+"[^"]*")?\)/g;
const CODE_SPAN = /`[^`]+`/g;
const BOLD = /\*\*(?=\S)[^*]*?\S\*\*|__(?=\S)[^_]*?\S__/g;
const URL = /<https?:\/\/[^>]+>|https?:\/\/\S+/g;

/** In the order findings on one line are reported. */
const MARKUP: readonly Markup[] = [
  { kind: "a heading", pattern: /^\s*#{1,6}\s+\S.*$/, on: "raw" },
  { kind: "bold", pattern: BOLD, on: "text" },
  { kind: "italics", pattern: /(?<![\p{L}\d*\\])\*(?=[^\s*])[^*]*?[^\s*\\]?\*(?![\p{L}\d*])|(?<![\p{L}\d_\\])_(?=[^\s_])[^_]*?[^\s_\\]?_(?![\p{L}\d_])/u, on: "text" },
  { kind: "a bracket link", pattern: LINK, on: "raw" },
  { kind: "an embedded image", pattern: IMAGE, on: "raw" },
  { kind: "a quote", pattern: /^\s*>.*$/, on: "raw" },
  { kind: "a table", pattern: /^\s*\|.*\|\s*$/, on: "raw" },
  { kind: "inline code", pattern: CODE_SPAN, on: "raw" },
  { kind: "a code block", pattern: FENCE, on: "raw" },
  { kind: "a horizontal rule", pattern: /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/, on: "raw" },
  { kind: "HTML", pattern: /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/i, on: "text" },
];

/**
 * Markdown that a plain-text editor (a forum, a social network, a mail) shows as literal characters. Each kind
 * is reported once, at its first line. A bare URL and `- ` or `1. ` lists read fine and stay.
 */
export function checkChannelMarkup(text: string): QualityFinding[] {
  const first = new Map<string, { line: number; sample: string }>();
  const note = (kind: string, line: number, sample: string): void => {
    if (!first.has(kind)) first.set(kind, { line, sample: sample.trim() });
  };
  let inFence = false;
  for (const [index, raw] of text.replace(/\r\n?/g, "\n").split("\n").entries()) {
    const line = index + 1;
    if (FENCE.test(raw)) {
      if (!inFence) note("a code block", line, raw);
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const plain = raw.replace(LIST_MARKER, "").replace(IMAGE, " ").replace(LINK, " ").replace(CODE_SPAN, " ").replace(URL, " ");
    for (const markup of MARKUP) {
      if (markup.kind === "a code block") continue;
      const source = markup.on === "raw" ? raw : markup.kind === "italics" ? plain.replace(BOLD, " ") : plain;
      const match = new RegExp(markup.pattern.source, markup.pattern.flags.replace("g", "")).exec(source);
      if (match !== null) note(markup.kind, line, match[0]);
    }
  }
  return MARKUP.flatMap((markup) => {
    const hit = first.get(markup.kind);
    return hit === undefined
      ? []
      : [{ rule: "channel-markup", severity: "error" as const, message: `${markup.kind} ("${hit.sample}"): a plain-text editor shows the markup as is; write it as plain text`, line: hit.line }];
  });
}
