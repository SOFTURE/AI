import ts from "typescript";

export interface StripCommentsOptions {
  /**
   * `tsx` (default) and `ts` parse the source as TypeScript (`ts` for `<T>value` casts); `hash` treats
   * `#` as the start of a comment, at the start of a line or after a space and outside quotes (YAML, shell).
   */
  syntax?: "tsx" | "ts" | "hash";
}

/**
 * The source with every comment blanked out: comment characters become spaces and line breaks stay,
 * so line and column numbers still point at the original. TypeScript is parsed, so `//` inside a
 * string, a URL, a regex literal or JSX text is not a comment.
 */
export function stripComments(source: string, options: StripCommentsOptions = {}): string {
  const syntax = options.syntax ?? "tsx";
  if (syntax === "hash") return source.split("\n").map(stripHashComment).join("\n");
  return blankRanges(source, findCommentRanges(source, syntax === "ts" ? ts.ScriptKind.TS : ts.ScriptKind.TSX));
}

function findCommentRanges(source: string, kind: ts.ScriptKind): ts.CommentRange[] {
  const tree = ts.createSourceFile("source.tsx", source, ts.ScriptTarget.Latest, true, kind);
  const jsxTexts: ts.TextRange[] = [];
  const ranges = new Map<number, ts.CommentRange>();
  const add = (found: ts.CommentRange[] | undefined) => found?.forEach((range) => ranges.set(range.pos, range));
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      jsxTexts.push(node);
      return;
    }
    add(ts.getLeadingCommentRanges(source, node.pos));
    add(ts.getTrailingCommentRanges(source, node.end));
    node.getChildren(tree).forEach(visit);
  };
  visit(tree);
  add(ts.getLeadingCommentRanges(source, tree.endOfFileToken.pos));
  return [...ranges.values()].filter((range) => !jsxTexts.some((text) => range.pos < text.end && range.end > text.pos));
}

function blankRanges(source: string, ranges: readonly ts.TextRange[]): string {
  // Ranges count UTF-16 units, so the source is blanked unit by unit.
  const units = source.split("");
  for (const { pos, end } of ranges) {
    for (let index = pos; index < end; index += 1) {
      const unit = units[index];
      if (unit !== undefined && unit !== "\n" && unit !== "\r") units[index] = " ";
    }
  }
  return units.join("");
}

function stripHashComment(line: string): string {
  let quote: string | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote !== null) {
      if (character === "\\" && quote === '"') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "#" && (index === 0 || /\s/.test(line[index - 1] ?? ""))) {
      return line.slice(0, index) + line.slice(index).replace(/[^\r]/g, " ");
    }
  }
  return line;
}
