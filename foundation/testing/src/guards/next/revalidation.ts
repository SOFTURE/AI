import ts from "typescript";
import type { SourceFile } from "../source-files.js";
import { findCalls, findLocalNames, formatHit, isAsync, parseFiles } from "./syntax.js";

const REVALIDATE_APIS = ["revalidatePath", "revalidateTag", "updateTag"];
const EXIT_CALLS = new Set(["redirect", "permanentRedirect", "notFound", "forbidden", "unauthorized"]);

/**
 * Rule 2: `revalidatePath` / `revalidateTag` / `updateTag` (from `next/cache`) run only once the write
 * is known to have succeeded. Without types that is read from the syntax: a call passes inside a
 * branch (`if`/`else`, a `switch` case, `?:`, `&&`, `||`, `??`), after an `if` earlier in an enclosing
 * block that exits (`return`, `throw`, `redirect()`, `notFound()`), or after an `await` inside the same
 * `try` block (a write that throws on failure). It fails at the top level of a function before any
 * such check, and anywhere in a `catch` or `finally` block. A sync function cannot await a write,
 * so it is a refresh helper and passes; the rule does not follow it to its callers.
 */
export function findUnguardedRevalidation(files: readonly SourceFile[]): string[] {
  return parseFiles(files).flatMap((parsed) => {
    const locals = findLocalNames(parsed.tree, "next/cache", REVALIDATE_APIS);
    return findCalls(parsed.tree, locals).flatMap((call) => {
      const name = locals.get((call.expression as ts.Identifier).text) ?? "revalidatePath";
      const problem = findProblem(call);
      return problem === null ? [] : [formatHit(parsed, call, `${name}() runs ${problem}; call it only in the success branch`)];
    });
  });
}

function findProblem(call: ts.CallExpression): string | null {
  const path = ancestorsUpToFunction(call);
  const enclosing = path.at(-1);
  if (enclosing !== undefined && isRefreshHelper(enclosing)) return null;
  for (let index = 1; index < path.length; index += 1) {
    const node = path[index];
    const child = path[index - 1];
    if (node !== undefined && ts.isCatchClause(node)) return "in a catch block";
    if (node !== undefined && ts.isTryStatement(node) && child === node.finallyBlock) return "in a finally block";
  }
  for (let index = 1; index < path.length; index += 1) {
    const node = path[index];
    const child = path[index - 1];
    if (node === undefined || child === undefined) continue;
    if (isBranchOf(node, child)) return null;
    if (isStatementList(node) && hasExitingCheckBefore(node, child)) return null;
    if (ts.isBlock(node) && ts.isTryStatement(node.parent) && node.parent.tryBlock === node && hasAwaitBefore(node, child)) return null;
  }
  return "before the write is known to have succeeded";
}

/** The call and its ancestors, up to and including the enclosing function (or the file). */
function ancestorsUpToFunction(node: ts.Node): ts.Node[] {
  const path: ts.Node[] = [node];
  let current = node;
  while (!ts.isSourceFile(current) && !ts.isFunctionLike(current)) {
    current = current.parent;
    path.push(current);
  }
  return path;
}

/** A sync function cannot await a write: it only refreshes, and its callers decide when. */
function isRefreshHelper(node: ts.Node): boolean {
  return ts.isFunctionLike(node) && !isAsync(node);
}

function isBranchOf(node: ts.Node, child: ts.Node): boolean {
  if (ts.isIfStatement(node)) return child === node.thenStatement || child === node.elseStatement;
  if (ts.isConditionalExpression(node)) return child === node.whenTrue || child === node.whenFalse;
  if (ts.isCaseClause(node) || ts.isDefaultClause(node)) return true;
  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind;
    const isShortCircuit =
      operator === ts.SyntaxKind.AmpersandAmpersandToken || operator === ts.SyntaxKind.BarBarToken || operator === ts.SyntaxKind.QuestionQuestionToken;
    return isShortCircuit && child === node.right;
  }
  return false;
}

function isStatementList(node: ts.Node): node is ts.Block | ts.SourceFile {
  return ts.isBlock(node) || ts.isSourceFile(node);
}

function statementsBefore(list: ts.Block | ts.SourceFile, child: ts.Node): readonly ts.Statement[] {
  const index = list.statements.findIndex((statement) => statement === child);
  return index < 0 ? [] : list.statements.slice(0, index);
}

function hasExitingCheckBefore(list: ts.Block | ts.SourceFile, child: ts.Node): boolean {
  return statementsBefore(list, child).some((statement) => ts.isIfStatement(statement) && exits(statement.thenStatement));
}

function exits(statement: ts.Statement): boolean {
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) return true;
  if (ts.isBlock(statement)) {
    const last = statement.statements.at(-1);
    return last !== undefined && exits(last);
  }
  if (ts.isExpressionStatement(statement)) {
    const expression = ts.isAwaitExpression(statement.expression) ? statement.expression.expression : statement.expression;
    return ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && EXIT_CALLS.has(expression.expression.text);
  }
  return false;
}

function hasAwaitBefore(list: ts.Block, child: ts.Node): boolean {
  return statementsBefore(list, child).some(containsAwait);
}

function containsAwait(node: ts.Node): boolean {
  if (ts.isAwaitExpression(node)) return true;
  if (ts.isFunctionLike(node)) return false;
  return ts.forEachChild(node, (child) => (containsAwait(child) ? true : undefined)) ?? false;
}
