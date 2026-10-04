// The body of an article cut into blocks with file lines (FIRE_TRACKER `src/lib/blog/quality/parse.ts`,
// `splitBlocks`). Line-level rules need no Markdown tree: headings, paragraphs, list items, tables,
// quotes, footnote definitions and `::` directives are enough. Fenced code and HTML comments are
// skipped: the gate judges prose, not examples.

export type BlockKind = "heading" | "paragraph" | "listItem" | "table" | "quote" | "footnote" | "directive";

export interface Block {
  readonly kind: BlockKind;
  /** The text without the block marker (`#`, `-`, `>`, `[^id]:`); lines of a paragraph joined by spaces. */
  text: string;
  /** The line of the file, from 1. */
  readonly line: number;
  /** Heading level, 1–6. */
  readonly level?: number;
  /** Footnote id of a definition. */
  readonly footnoteId?: string;
}

/** The body of an article file and the file line it starts on, or `null` without a frontmatter. */
export function splitArticleBody(text: string): { readonly body: string; readonly bodyStartLine: number } | null {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  return { body: lines.slice(end + 1).join("\n"), bodyStartLine: end + 2 };
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
const FOOTNOTE_DEF = /^\[\^([^\]]+)\]:\s*(.*)$/;
const FENCE = /^\s*(```|~~~)/;
const CONTINUATION = /^\s{2,}\S/;

interface Pending {
  readonly lines: string[];
  readonly line: number;
}

export function splitBlocks(body: string, bodyStartLine = 1): Block[] {
  const blocks: Block[] = [];
  let paragraph: Pending | null = null;
  let table: Pending | null = null;
  let inFence = false;
  let inComment = false;

  const flush = (): void => {
    if (paragraph !== null) blocks.push({ kind: "paragraph", text: paragraph.lines.join(" "), line: paragraph.line });
    if (table !== null) blocks.push({ kind: "table", text: table.lines.join("\n"), line: table.line });
    paragraph = null;
    table = null;
  };

  for (const [index, raw] of body.split("\n").entries()) {
    const lineNo = bodyStartLine + index;
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (FENCE.test(line)) {
      flush();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (inComment) {
      if (line.includes("-->")) inComment = false;
      continue;
    }
    if (trimmed.startsWith("<!--")) {
      flush();
      inComment = !line.includes("-->");
      continue;
    }
    if (trimmed === "") {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading !== null) {
      flush();
      blocks.push({ kind: "heading", text: (heading[2] ?? "").trim(), line: lineNo, level: (heading[1] ?? "#").length });
      continue;
    }
    const footnote = FOOTNOTE_DEF.exec(line);
    if (footnote !== null) {
      flush();
      blocks.push({ kind: "footnote", text: (footnote[2] ?? "").trim(), line: lineNo, footnoteId: footnote[1] ?? "" });
      continue;
    }
    if (trimmed.startsWith("::")) {
      flush();
      blocks.push({ kind: "directive", text: trimmed, line: lineNo });
      continue;
    }
    if (trimmed.startsWith("|")) {
      if (paragraph !== null) flush();
      table ??= { lines: [], line: lineNo };
      table.lines.push(trimmed);
      continue;
    }
    const listItem = LIST_ITEM.exec(line);
    if (listItem !== null) {
      flush();
      blocks.push({ kind: "listItem", text: (listItem[1] ?? "").trim(), line: lineNo });
      continue;
    }
    if (trimmed.startsWith(">")) {
      flush();
      blocks.push({ kind: "quote", text: trimmed.replace(/^>\s?/, ""), line: lineNo });
      continue;
    }
    // An indented line continues the list item or footnote above it.
    const previous = blocks.at(-1);
    if (paragraph === null && table === null && CONTINUATION.test(raw) && (previous?.kind === "listItem" || previous?.kind === "footnote")) {
      previous.text = `${previous.text} ${trimmed}`;
      continue;
    }
    if (table !== null) flush();
    paragraph ??= { lines: [], line: lineNo };
    paragraph.lines.push(trimmed);
  }
  flush();
  return blocks;
}

const PROSE_KINDS: ReadonlySet<BlockKind> = new Set(["paragraph", "listItem", "table", "quote", "heading"]);

/** The blocks a reader reads as text: no footnote definitions, no directives. */
export function getProseBlocks(blocks: readonly Block[]): Block[] {
  return blocks.filter((block) => PROSE_KINDS.has(block.kind));
}
