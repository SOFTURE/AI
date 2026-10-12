import ts from "typescript";
import type { SourceFile } from "../source-files.js";

/** A source file parsed once for the Next.js guards. */
export interface ParsedFile {
  file: string;
  tree: ts.SourceFile;
}

/** Parses each file as TSX, or as TS when it ends in `.ts` (so `<T>value` casts parse). */
export function parseFiles(files: readonly SourceFile[]): ParsedFile[] {
  return files.map(({ file, source }) => ({
    file,
    tree: ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, /\.[cm]?ts$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.TSX),
  }));
}

/** Whether the file starts with the directive (`"use server"`, `"use client"`), before any other statement. */
export function hasDirective(tree: ts.SourceFile, directive: string): boolean {
  for (const statement of tree.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) return false;
    if (statement.expression.text === directive) return true;
  }
  return false;
}

/** `file:line: message` for a node. */
export function formatHit(parsed: ParsedFile, node: ts.Node, message: string): string {
  const line = parsed.tree.getLineAndCharacterOfPosition(node.getStart(parsed.tree)).line + 1;
  return `${parsed.file}:${String(line)}: ${message}`;
}

/** A named value import: the local name, the name the module exports and the import node. */
export interface ImportedName {
  local: string;
  imported: string;
  module: string;
  node: ts.Node;
}

/**
 * The value imports of a file: named, default (`imported` is `default`) and namespace (`imported` is `*`).
 * Type-only imports (`import type`, `import { type X }`) are left out.
 */
export function readValueImports(tree: ts.SourceFile): ImportedName[] {
  return tree.statements.flatMap((statement) => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return [];
    const clause = statement.importClause;
    if (clause === undefined || clause.isTypeOnly) return [];
    const module = statement.moduleSpecifier.text;
    const names: ImportedName[] = [];
    if (clause.name !== undefined) names.push({ local: clause.name.text, imported: "default", module, node: clause.name });
    const bindings = clause.namedBindings;
    if (bindings !== undefined && ts.isNamespaceImport(bindings)) {
      names.push({ local: bindings.name.text, imported: "*", module, node: bindings });
    }
    if (bindings !== undefined && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (element.isTypeOnly) continue;
        names.push({ local: element.name.text, imported: (element.propertyName ?? element.name).text, module, node: element });
      }
    }
    return names;
  });
}

/** Whether the file imports the module for its side effects or values (`import "server-only"`). */
export function importsModule(tree: ts.SourceFile, module: string): boolean {
  return tree.statements.some(
    (statement) => ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === module,
  );
}

/** The local names under which a file imports `names` from `module` (aliases followed). */
export function findLocalNames(tree: ts.SourceFile, module: string, names: readonly string[]): Map<string, string> {
  const locals = new Map<string, string>();
  for (const imported of readValueImports(tree)) {
    if (imported.module === module && names.includes(imported.imported)) locals.set(imported.local, imported.imported);
  }
  return locals;
}

/** A function the module exports with its body and parameters. */
export interface ExportedFunction {
  name: string;
  node: ts.FunctionLikeDeclaration;
}

/**
 * The functions the module exports by declaration: `export function`, `export default function` and
 * `export const name = (…) => …` / `function (…) {…}`.
 */
export function findExportedFunctions(tree: ts.SourceFile): ExportedFunction[] {
  return tree.statements.flatMap((statement): ExportedFunction[] => {
    if (ts.isFunctionDeclaration(statement) && hasExportModifier(statement) && statement.body !== undefined) {
      return [{ name: statement.name?.text ?? "default", node: statement }];
    }
    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      return statement.declarationList.declarations.flatMap((declaration) => {
        const initializer = declaration.initializer === undefined ? undefined : unwrap(declaration.initializer);
        if (initializer === undefined || !ts.isIdentifier(declaration.name)) return [];
        return ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer) ? [{ name: declaration.name.text, node: initializer }] : [];
      });
    }
    return [];
  });
}

/** Whether a statement carries `export`. */
export function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

/** Whether a function is declared `async`. */
export function isAsync(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword);
}

/** The expression without parentheses, `as`, `satisfies` and `!`. */
export function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isNonNullExpression(current)) {
    current = current.expression;
  }
  return current;
}

/** Every call in the tree whose callee is a bare identifier among `locals`. */
export function findCalls(tree: ts.SourceFile, locals: ReadonlyMap<string, string>): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && locals.has(node.expression.text)) calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return calls;
}

/** Sorts `file:line: message` hits by file, then by line number. */
export function sortHits(hits: readonly string[]): string[] {
  const key = (hit: string) => {
    const match = /^(.*?):(\d+):/.exec(hit);
    return { file: match?.[1] ?? hit, line: Number(match?.[2] ?? 0) };
  };
  return [...hits].sort((a, b) => {
    const left = key(a);
    const right = key(b);
    if (left.file !== right.file) return left.file < right.file ? -1 : 1;
    return left.line - right.line;
  });
}
