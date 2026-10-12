import ts from "typescript";
import type { SourceFile } from "../source-files.js";
import { DEFAULT_ERROR_PARAMS } from "./options.js";
import { findCalls, findLocalNames, formatHit, parseFiles } from "./syntax.js";

export interface RedirectErrorOptions {
  /** Query parameters that must not carry free text. Default: {@link DEFAULT_ERROR_PARAMS}. */
  params?: readonly string[];
}

/** A value that is a code (`invalid_token`, `auth.expired`), not free text. */
const CODE_VALUE = /^[\w.-]*$/;
/** An expression that turns an error into text. */
const ERROR_TEXT = /\.(?:message|stack)\b|\bString\(|\bJSON\.stringify\(|\.toString\(/;

/**
 * Rule 6: error details never travel in a URL. A `redirect` / `permanentRedirect` (from
 * `next/navigation`) whose URL sets one of `params` is reported when the value is a literal that is not
 * code-shaped (`?error=Something went wrong`) or an expression that turns an error into text
 * (`.message`, `.stack`, `String(…)`, `JSON.stringify(…)`, `.toString()`). A code from a variable
 * (`?error=${result.error}`) passes: pass a code and let the page look up its copy.
 */
export function findErrorDetailsInRedirects(files: readonly SourceFile[], options: RedirectErrorOptions = {}): string[] {
  const params = options.params ?? DEFAULT_ERROR_PARAMS;
  return parseFiles(files).flatMap((parsed) => {
    const locals = findLocalNames(parsed.tree, "next/navigation", ["redirect", "permanentRedirect"]);
    return findCalls(parsed.tree, locals).flatMap((call) => {
      const url = call.arguments[0];
      const param = url === undefined ? null : findFreeTextParam(parsed.tree, url, params);
      return param === null ? [] : [formatHit(parsed, call, `redirect URL carries free text in ?${param}=; pass a code and look its copy up on the page`)];
    });
  });
}

function findFreeTextParam(tree: ts.SourceFile, url: ts.Expression, params: readonly string[]): string | null {
  const pieces = flattenUrl(tree, url);
  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    if (piece?.kind !== "text") continue;
    for (const param of params) {
      for (const match of piece.text.matchAll(new RegExp(`[?&]${escapeRegExp(param)}=([^&#]*)`, "g"))) {
        const value = match[1] ?? "";
        if (!CODE_VALUE.test(decodeValue(value))) return param;
        const isAtEnd = match.index + match[0].length === piece.text.length;
        const next = pieces[index + 1];
        if (isAtEnd && next?.kind === "expression" && ERROR_TEXT.test(next.text)) return param;
      }
    }
  }
  return null;
}

type UrlPiece = { kind: "text"; text: string } | { kind: "expression"; text: string };

/** A URL expression as literal text and expressions in order: a string, a template or a `+` chain. */
function flattenUrl(tree: ts.SourceFile, expression: ts.Expression): UrlPiece[] {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return [{ kind: "text", text: expression.text }];
  if (ts.isTemplateExpression(expression)) {
    return [
      { kind: "text", text: expression.head.text },
      ...expression.templateSpans.flatMap((span): UrlPiece[] => [
        { kind: "expression", text: span.expression.getText(tree) },
        { kind: "text", text: span.literal.text },
      ]),
    ];
  }
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return [...flattenUrl(tree, expression.left), ...flattenUrl(tree, expression.right)];
  }
  if (ts.isParenthesizedExpression(expression)) return flattenUrl(tree, expression.expression);
  return [{ kind: "expression", text: expression.getText(tree) }];
}

function decodeValue(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    // A malformed escape is not a code either.
    return value.length > 0 ? " " : value;
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
