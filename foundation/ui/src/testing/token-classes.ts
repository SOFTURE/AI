import ts from "typescript";
import { type GuardSource, getLine, parseSource, walkNodes } from "./guard-source.js";

export interface TokenClassOptions {
  /**
   * The CSS that defines the tokens: the app's own stylesheet and the `@theme` bridges it imports
   * (`@softure-ai/ui/tailwind.css`). `@import` is not followed, so pass every file with a `@theme`.
   */
  readonly css: string | readonly string[];
  readonly sources: readonly GuardSource[];
  /** The Tailwind prefix (`sft` for `sft:bg-surface`): only classes with it are checked. */
  readonly prefix?: string;
  /** Classes never reported: a string matches the class as written, a RegExp tests it. */
  readonly allow?: readonly (string | RegExp)[];
}

interface Theme {
  /** Variables declared inside `@theme` blocks: the ones Tailwind turns into utilities. */
  readonly themeVariables: ReadonlySet<string>;
  /** Every variable declared anywhere, which a `(--name)` reference may read. */
  readonly declaredVariables: ReadonlySet<string>;
}

const UTILITY = /^(bg|text|border(?:-[xytrblse])?|fill|stroke|outline|ease|duration)-(.+)$/;
const NUMBER = /^\d+(?:\.\d+)?$/;
const SHARED_KEYWORDS = /^(?:inherit|current|transparent|initial)$/;
// The non-colour utilities behind each colour prefix (Tailwind 4).
const KEYWORDS: Readonly<Record<string, RegExp>> = {
  bg: /^(?:none|auto|cover|contain|fixed|local|scroll|center|(?:left|right|top|bottom)(?:-(?:left|right|top|bottom))?|no-repeat|repeat(?:-.+)?|(?:clip|origin|blend|linear|size|position)-.+|radial(?:-.+)?|conic(?:-.+)?)$/,
  text: /^(?:left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|shadow(?:-.+)?)$/,
  border: /^(?:[xytrblse]|solid|dashed|dotted|double|hidden|none|collapse|separate|spacing(?:-.+)?)$/,
  fill: /^none$/,
  stroke: /^none$/,
  outline: /^(?:none|hidden|solid|dashed|dotted|double|offset-.+)$/,
  ease: /^linear$/,
  duration: /^$/,
};

/**
 * The Tailwind classes in the sources' string literals whose colour, `ease-*` or `duration-*` value
 * names no defined token, as `file:line: class`. Such a class compiles to nothing, silently.
 *
 * - Colour utilities (`bg-`, `text-`, `border-` and its sides, `fill-`, `stroke-`, `outline-`) need a
 *   `--color-<value>` in a `@theme` block; `text-<size>` passes with a `--text-<size>`.
 * - `ease-<name>` needs an `--ease-<name>`; a named `duration-*` is always reported, since Tailwind 4
 *   has no duration namespace (use a number or `duration-(--token)`).
 * - A `(--name)` value needs `--name` declared anywhere in the CSS.
 * - Arbitrary values (`bg-[…]`), keyword and numeric utilities (`text-left`, `border-2`) pass, as do
 *   classes glued to a template interpolation, which are only known at run time.
 */
export function findUndefinedTokenClasses({ css, sources, prefix, allow = [] }: TokenClassOptions): string[] {
  const theme = readTheme(typeof css === "string" ? [css] : css);
  const isAllowed = (className: string) => allow.some((entry) => (typeof entry === "string" ? entry === className : entry.test(className)));
  return sources.flatMap((source) =>
    readClassTokens(source).flatMap(({ line, className }) =>
      !isAllowed(className) && isUndefinedTokenClass(className, theme, prefix) ? [`${source.file}:${String(line)}: ${className}`] : [],
    ),
  );
}

function readTheme(cssTexts: readonly string[]): Theme {
  const themeVariables = new Set<string>();
  const declaredVariables = new Set<string>();
  for (const css of cssTexts) {
    for (const name of readVariableNames(css)) declaredVariables.add(name);
    for (const block of readThemeBlocks(css)) for (const name of readVariableNames(block)) themeVariables.add(name);
  }
  return { themeVariables, declaredVariables };
}

function readVariableNames(css: string): string[] {
  return [...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1] ?? "");
}

/** The bodies of every `@theme … { … }` block, braces matched. */
function readThemeBlocks(css: string): string[] {
  const blocks: string[] = [];
  for (const match of css.matchAll(/@theme\b[^{;]*\{/g)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = start;
    while (end < css.length && depth > 0) {
      if (css[end] === "{") depth += 1;
      if (css[end] === "}") depth -= 1;
      end += 1;
    }
    blocks.push(css.slice(start, end - 1));
  }
  return blocks;
}

interface ClassToken {
  readonly line: number;
  readonly className: string;
}

/** Whitespace-separated words of every string and template literal, with their lines. */
function readClassTokens(source: GuardSource): ClassToken[] {
  const file = parseSource(source);
  const tokens: ClassToken[] = [];
  walkNodes(file, (node) => {
    const literal = readLiteralContent(node, file);
    if (literal === null) return;
    const words = [...literal.content.matchAll(/\S+/g)];
    words.forEach((word, index) => {
      const isGluedBefore = literal.isAfterInterpolation && index === 0 && word.index === 0;
      const isGluedAfter = literal.isBeforeInterpolation && index === words.length - 1 && word.index + word[0].length === literal.content.length;
      if (isGluedBefore || isGluedAfter) return;
      tokens.push({ line: getLine(file, literal.start + word.index), className: word[0] });
    });
  });
  return tokens;
}

interface LiteralContent {
  readonly content: string;
  /** Position of the content's first character in the file. */
  readonly start: number;
  readonly isAfterInterpolation: boolean;
  readonly isBeforeInterpolation: boolean;
}

function readLiteralContent(node: ts.Node, file: ts.SourceFile): LiteralContent | null {
  const isPlain = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
  const isHead = ts.isTemplateHead(node);
  const isMiddle = ts.isTemplateMiddle(node);
  const isTail = ts.isTemplateTail(node);
  if (!isPlain && !isHead && !isMiddle && !isTail) return null;
  const isBeforeInterpolation = isHead || isMiddle;
  const start = node.getStart(file) + 1;
  const end = node.getEnd() - (isBeforeInterpolation ? 2 : 1);
  return { content: file.text.slice(start, end), start, isAfterInterpolation: isMiddle || isTail, isBeforeInterpolation };
}

function isUndefinedTokenClass(className: string, theme: Theme, prefix: string | undefined): boolean {
  let utility = className;
  if (prefix !== undefined) {
    if (!utility.startsWith(`${prefix}:`)) return false;
    utility = utility.slice(prefix.length + 1);
  }
  utility = stripVariants(utility).replace(/^!|!$/g, "").replace(/^-/, "");
  const match = UTILITY.exec(utility);
  if (!match) return false;
  const [, name = "", rawValue = ""] = match;
  const value = stripModifier(rawValue);
  if (value === "" || value.startsWith("[")) return false;
  if (value.startsWith("(")) {
    const reference = /^\((?:[\w-]+:)?(--[\w-]+)\)$/.exec(value);
    return reference === null || !theme.declaredVariables.has(reference[1] ?? "");
  }
  const family = name.startsWith("border") ? "border" : name;
  if (NUMBER.test(value) || SHARED_KEYWORDS.test(value) || (KEYWORDS[family]?.test(value) ?? false)) return false;
  if (family === "duration") return true;
  if (family === "ease") return !theme.themeVariables.has(`--ease-${value}`);
  if (family === "text" && theme.themeVariables.has(`--text-${value}`)) return false;
  return !theme.themeVariables.has(`--color-${value}`);
}

/** The class after its last variant (`md:hover:bg-x` → `bg-x`), ignoring colons inside `[…]` and `(…)`. */
function stripVariants(className: string): string {
  return className.slice(findLastTopLevel(className, ":") + 1);
}

/** The value without its opacity modifier (`brand/40` → `brand`). */
function stripModifier(value: string): string {
  const slash = findLastTopLevel(value, "/");
  return slash === -1 ? value : value.slice(0, slash);
}

function findLastTopLevel(text: string, char: string): number {
  let depth = 0;
  let found = -1;
  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    if (current === "[" || current === "(") depth += 1;
    else if (current === "]" || current === ")") depth = Math.max(0, depth - 1);
    else if (current === char && depth === 0) found = index;
  }
  return found;
}
