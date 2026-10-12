import ts from "typescript";

/**
 * A source file a guard reads: its path as reported and its text. `readSourceFiles` from
 * `@softure-ai/testing/guards` returns this shape.
 */
export interface GuardSource {
  readonly file: string;
  readonly source: string;
}

/** A file path allowed by a guard: a string matches the path exactly or as its end, a RegExp tests it. */
export type AllowedFile = string | RegExp;

/** Whether `file` is one of `allowed` ({@link AllowedFile}). */
export function isAllowedFile(file: string, allowed: readonly AllowedFile[]): boolean {
  return allowed.some((entry) => (typeof entry === "string" ? file === entry || file.endsWith(`/${entry}`) : entry.test(file)));
}

/** Parses a source as TSX, which also reads plain TypeScript. */
export function parseSource({ file, source }: GuardSource): ts.SourceFile {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** The 1-based line of a position in a parsed file. */
export function getLine(file: ts.SourceFile, position: number): number {
  return file.getLineAndCharacterOfPosition(position).line + 1;
}

/** Calls `visit` for every node of the file, depth first. */
export function walkNodes(file: ts.SourceFile, visit: (node: ts.Node) => void): void {
  const walk = (node: ts.Node) => {
    visit(node);
    ts.forEachChild(node, walk);
  };
  walk(file);
}
