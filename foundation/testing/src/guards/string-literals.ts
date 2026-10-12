import ts from "typescript";
import type { SourceFile } from "./source-files.js";
import type { VisibleText } from "./visible-text.js";

/**
 * Every string and template literal in the files' code (JSX attribute values too; text between tags
 * is `collectVisibleTexts`'s), shaped like a visible text (`attribute` is null) so
 * `findForbiddenPhrases` takes them: a vocabulary guard over plain `.ts`.
 * Left out: module specifiers, directives (`"use client"`), literal types and property names. A
 * template keeps its `${…}` placeholders as written; whitespace-only literals are left out.
 */
export function collectStringLiterals(files: readonly SourceFile[]): VisibleText[] {
  return files.flatMap(({ file, source }) => {
    const kind = /\.[cm]?ts$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.TSX;
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    const found: VisibleText[] = [];
    const visit = (node: ts.Node) => {
      if (isSkipped(node)) return;
      const text = readText(node, tree);
      if (text !== null) {
        if (text.trim() !== "") found.push({ file, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, attribute: null, text: text.trim() });
        if (!ts.isTemplateExpression(node)) return;
        node.templateSpans.forEach((span) => visit(span.expression));
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
    return found;
  });
}

function readText(node: ts.Node, tree: ts.SourceFile): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.getText(tree).slice(1, -1);
  return null;
}

function isSkipped(node: ts.Node): boolean {
  const parent = node.parent as ts.Node | undefined;
  if (parent === undefined) return false;
  if (ts.isLiteralTypeNode(node) || ts.isImportTypeNode(node)) return true;
  if ((ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && node === parent.moduleSpecifier) return true;
  if (ts.isExternalModuleReference(parent)) return true;
  if (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
  if (ts.isExpressionStatement(parent) && ts.isStringLiteral(node) && isDirective(parent)) return true;
  if ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent)) && node === parent.name) {
    return true;
  }
  return ts.isModuleDeclaration(parent) && node === parent.name;
}

function isDirective(statement: ts.ExpressionStatement): boolean {
  const container = statement.parent;
  if (!ts.isSourceFile(container) && !ts.isBlock(container)) return false;
  for (const sibling of container.statements) {
    if (!ts.isExpressionStatement(sibling) || !ts.isStringLiteral(sibling.expression)) return false;
    if (sibling === statement) return true;
  }
  return false;
}
