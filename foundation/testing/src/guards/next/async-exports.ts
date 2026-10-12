import ts from "typescript";
import type { SourceFile } from "../source-files.js";
import { formatHit, hasDirective, hasExportModifier, isAsync, parseFiles, unwrap, type ParsedFile } from "./syntax.js";

/**
 * Rule 1: a `"use server"` module exports only async functions. Next.js refuses anything else at build
 * time, but only on a route that imports the module. Types and interfaces are erased and pass;
 * `export { name }` is checked against the local declaration; a re-export from another module
 * (`export { name } from`, `export * from`) cannot be proven from this file and is reported too.
 */
export function findNonAsyncServerExports(files: readonly SourceFile[]): string[] {
  return parseFiles(files)
    .filter(({ tree }) => hasDirective(tree, "use server"))
    .flatMap((parsed) => parsed.tree.statements.flatMap((statement) => checkStatement(parsed, statement)));
}

function checkStatement(parsed: ParsedFile, statement: ts.Statement): string[] {
  const hit = (node: ts.Node, what: string) => [formatHit(parsed, node, `"use server" module exports ${what}; export only async functions`)];
  if (ts.isFunctionDeclaration(statement) && hasExportModifier(statement)) {
    return isAsync(statement) ? [] : hit(statement, `the sync function ${statement.name?.text ?? "default"}`);
  }
  if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) =>
      isAsyncFunctionValue(declaration.initializer) ? [] : hit(declaration, `${declaration.name.getText(parsed.tree)}, which is not an async function`),
    );
  }
  if (ts.isClassDeclaration(statement) && hasExportModifier(statement)) return hit(statement, `the class ${statement.name?.text ?? "default"}`);
  if (ts.isEnumDeclaration(statement) && hasExportModifier(statement)) return hit(statement, `the enum ${statement.name.text}`);
  if (ts.isExportAssignment(statement)) {
    return isAsyncFunctionValue(statement.expression) ||
      (ts.isIdentifier(statement.expression) && isLocalAsyncFunction(parsed.tree, statement.expression.text))
      ? []
      : hit(statement, "a default value that is not an async function");
  }
  if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) return checkExportDeclaration(parsed, statement, hit);
  return [];
}

function checkExportDeclaration(parsed: ParsedFile, statement: ts.ExportDeclaration, hit: (node: ts.Node, what: string) => string[]): string[] {
  const clause = statement.exportClause;
  if (statement.moduleSpecifier !== undefined) {
    const names = clause !== undefined && ts.isNamedExports(clause) ? clause.elements.filter((element) => !element.isTypeOnly) : [];
    if (clause !== undefined && ts.isNamedExports(clause) && names.length === 0) return [];
    return hit(statement, `${statement.moduleSpecifier.getText(parsed.tree)} re-exported, which this file cannot prove async`);
  }
  if (clause === undefined || !ts.isNamedExports(clause)) return [];
  return clause.elements
    .filter((element) => !element.isTypeOnly)
    .flatMap((element) => {
      const local = (element.propertyName ?? element.name).getText(parsed.tree);
      return isLocalAsyncFunction(parsed.tree, local) || isLocalType(parsed.tree, local)
        ? []
        : hit(element, `${local}, which is not an async function declared in this file`);
    });
}

function isAsyncFunctionValue(expression: ts.Expression | undefined): boolean {
  if (expression === undefined) return false;
  const value = unwrap(expression);
  return (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) && isAsync(value);
}

function isLocalAsyncFunction(tree: ts.SourceFile, name: string): boolean {
  return tree.statements.some((statement) => {
    if (ts.isFunctionDeclaration(statement)) return statement.name?.text === name && isAsync(statement);
    if (!ts.isVariableStatement(statement)) return false;
    return statement.declarationList.declarations.some(
      (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name && isAsyncFunctionValue(declaration.initializer),
    );
  });
}

function isLocalType(tree: ts.SourceFile, name: string): boolean {
  return tree.statements.some((statement) => (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) && statement.name.text === name);
}
