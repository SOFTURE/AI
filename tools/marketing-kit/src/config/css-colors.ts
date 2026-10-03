/**
 * Brand colours read from the app's stylesheet at every load rather than copied by hand.
 *
 * A copy of the palette in the config would drift from the landing page at the first colour change
 * and nobody would notice, because a film has no visual tests. So the reader **refuses** instead of
 * guessing: a missing token, or a value that is not a colour literal (`color-mix(…)`), is an error
 * that names the token.
 *
 * It reads one theme: the top-level `[data-theme="<theme>"]` block (also written `:root[…]` or
 * `html[…]`) first, then the first `:root` block, because the film lives in the brand's world, not in
 * the viewer's system theme. A stylesheet with theme blocks but not the configured one is an error.
 * Roles point at a palette through `var(--…)`, so references resolve through the same two blocks. A
 * stylesheet without theme blocks is read from `:root` alone. Overrides inside `@media` rules are for
 * the site visitor's browser, not for the film.
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

/** A selector with its whitespace and attribute quotes dropped, so `[data-theme=dark]` and `[data-theme="dark"]` compare equal. */
function normalizeSelector(selector: string): string {
  return selector.replace(/\s+/g, "").replace(/["']/g, "");
}

/** The top-level rules of the stylesheet, as selector lists and bodies; at-rules and their nested rules are skipped. */
function listTopLevelRules(css: string): { selectors: string[]; body: string }[] {
  const rules: { selectors: string[]; body: string }[] = [];
  let depth = 0;
  let ruleStart = 0;
  let bodyStart = 0;
  let selectors: string[] = [];
  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];
    if (char === "{") {
      if (depth === 0) {
        selectors = css.slice(ruleStart, i).split(",").map(normalizeSelector);
        bodyStart = i + 1;
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        rules.push({ selectors, body: css.slice(bodyStart, i) });
        ruleStart = i + 1;
      }
    } else if (char === ";" && depth === 0) {
      ruleStart = i + 1;
    }
  }
  return rules;
}

/** The body of the first top-level rule whose selector list holds exactly one of these selectors. */
function findTopLevelBlock(rules: { selectors: string[]; body: string }[], selectors: readonly string[]): string | null {
  const wanted = selectors.map(normalizeSelector);
  return rules.find((rule) => rule.selectors.some((selector) => wanted.includes(selector)))?.body ?? null;
}

function readDeclaration(block: string, name: string): string | null {
  const match = new RegExp(`(?:^|[;{\\s])--${name}\\s*:\\s*([^;]+)(?:;|$)`).exec(block);
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
  const rules = listTopLevelRules(stripComments(css));
  const root = findTopLevelBlock(rules, [":root"]);
  if (root === null) return { ok: false, error: "the stylesheet has no top-level :root block" };
  const themed = findTopLevelBlock(rules, [`[data-theme="${theme}"]`, `:root[data-theme="${theme}"]`, `html[data-theme="${theme}"]`]);
  const hasThemes = rules.some((rule) => rule.selectors.some((selector) => selector.includes("[data-theme=")));
  // A stylesheet with themes but not this one would silently give the film the other theme's colours.
  if (themed === null && hasThemes) return { ok: false, error: `the stylesheet has theme blocks but no top-level [data-theme="${theme}"]` };
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
