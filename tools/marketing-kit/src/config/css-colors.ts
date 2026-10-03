/**
 * Brand colours read from the app's stylesheet at every load rather than copied by hand.
 *
 * A copy of the palette in the config would drift from the landing page at the first colour change
 * and nobody would notice, because a film has no visual tests. So the reader **refuses** instead of
 * guessing: a missing token, or a value that is not a colour literal (`color-mix(…)`), is an error
 * that names the token.
 *
 * It reads one theme: the top-level `[data-theme="<theme>"]` block first, then the first `:root`
 * block, because the film lives in the brand's world, not in the viewer's system theme. Roles point
 * at a palette through `var(--…)`, so references resolve through the same two blocks. A stylesheet
 * without theme blocks is read from `:root` alone. Overrides inside `@media` rules are for the site
 * visitor's browser, not for the film.
 */

import type { ColorTheme, ColorsResult } from "./colors.js";
import { isHexColor } from "./colors.js";

/** Drops every closed CSS comment in one linear pass (no backtracking regex); an unclosed one stays as written. */
function stripComments(css: string): string {
  let result = "";
  let index = 0;
  while (index < css.length) {
    const start = css.indexOf("/*", index);
    const end = start === -1 ? -1 : css.indexOf("*/", start + 2);
    if (end === -1) return result + css.slice(index);
    result += css.slice(index, start);
    index = end + 2;
  }
  return result;
}

function findTopLevelBlock(css: string, selectorStart: string): string | null {
  let depth = 0;
  let ruleStart = 0;
  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];
    if (char === "{") {
      if (depth === 0 && css.slice(ruleStart, i).trim().startsWith(selectorStart)) {
        let inner = 0;
        for (let j = i; j < css.length; j += 1) {
          if (css[j] === "{") inner += 1;
          if (css[j] === "}") inner -= 1;
          if (inner === 0) {
            return css.slice(i + 1, j);
          }
        }
        return null;
      }
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) ruleStart = i + 1;
      continue;
    }
    if (char === ";" && depth === 0) {
      ruleStart = i + 1;
    }
  }
  return null;
}

function readDeclaration(block: string, name: string): string | null {
  const match = new RegExp(`(?:^|[;{\\s])--${name}\\s*:\\s*([^;]+);`).exec(block);
  return match?.[1] === undefined ? null : match[1].trim();
}

const TOKEN_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The colour literal of every named custom property (`names` without the leading `--`), from the
 * given theme. Returns the first problem, naming the token, when one is missing or not `#rrggbb`-like.
 */
export function readCssColors(css: string, names: readonly string[], theme: ColorTheme): ColorsResult {
  const badName = names.find((name) => !TOKEN_NAME.test(name));
  if (badName !== undefined) return { ok: false, error: `"${badName}" is not a custom property name (lowercase letters, digits and hyphens)` };
  const clean = stripComments(css);
  const root = findTopLevelBlock(clean, ":root");
  if (root === null) return { ok: false, error: "the stylesheet has no top-level :root block" };
  const themed = findTopLevelBlock(clean, `[data-theme="${theme}"]`);
  const blocks = themed === null ? [root] : [themed, root];
  const lookup = (name: string): string | null => {
    for (const block of blocks) {
      const value = readDeclaration(block, name);
      if (value !== null) return value;
    }
    return null;
  };

  const colors: Record<string, string> = {};
  for (const name of names) {
    let value = lookup(name);
    const seen = new Set<string>();
    while (value !== null) {
      const reference = /^var\(--([a-z0-9-]+)\)$/.exec(value)?.[1];
      if (reference === undefined || seen.has(reference)) break;
      seen.add(reference);
      value = lookup(reference);
    }
    if (value === null) return { ok: false, error: `no --${name} in :root or [data-theme="${theme}"]` };
    if (!isHexColor(value)) return { ok: false, error: `--${name} is "${value}", and the film needs a colour literal (#rrggbb)` };
    colors[name] = value.toLowerCase();
  }
  return { ok: true, colors };
}
