import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

const CLASS_CALLS = new Set(["cn", "cva"]);
// cva options that name variants rather than hold classes.
const VARIANT_SELECTIONS = new Set(["defaultVariants"]);
const COMPARISONS = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken]);

function collectStrings(node: ts.Node, into: Set<string>): void {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    into.add(node.text);
    return;
  }
  // Object keys (cva variant names) are not classes; their values are, except where they select a variant.
  if (ts.isPropertyAssignment(node)) {
    if (!VARIANT_SELECTIONS.has(node.name.getText())) collectStrings(node.initializer, into);
    return;
  }
  // `buttonVariants({ variant: "ghost" })`: a call to a cva selects variants by name.
  if (ts.isCallExpression(node) && /Variants$/.test(node.expression.getText())) return;
  // `side === "left" && "…"`: the compared value is not a class.
  if (ts.isBinaryExpression(node) && COMPARISONS.has(node.operatorToken.kind)) return;
  ts.forEachChild(node, (child) => collectStrings(child, into));
}

/**
 * The class strings written in a component file: `className` attributes and the arguments of `cn` and `cva`
 * (variant values included, variant names left out).
 */
export function readSourceClassStrings(source: string, fileName: string): Set<string> {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const strings = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.name.getText(file) === "className" && node.initializer !== undefined) {
      collectStrings(node.initializer, strings);
      return;
    }
    if (ts.isCallExpression(node) && CLASS_CALLS.has(node.expression.getText(file))) {
      for (const argument of node.arguments) collectStrings(argument, strings);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return strings;
}

/** Every class name written in the `.tsx` files of the given folders. */
export function readSourceClassNames(folders: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const folder of folders) {
    for (const entry of readdirSync(folder).filter((name) => name.endsWith(".tsx"))) {
      for (const text of readSourceClassStrings(readFileSync(join(folder, entry), "utf8"), entry)) {
        for (const name of text.split(/\s+/)) if (name !== "") names.add(name);
      }
    }
  }
  return names;
}
