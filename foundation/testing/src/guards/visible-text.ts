import ts from "typescript";
import type { SourceFile } from "./source-files.js";

/** A text a person reads or hears, written into the markup of a source file. */
export interface VisibleText {
  file: string;
  /** 1-based. */
  line: number;
  /** The JSX attribute that carries it, or null for text between tags. */
  attribute: string | null;
  /** Trimmed; a template literal keeps its `${…}` placeholders as written. */
  text: string;
}

export interface VisibleTextOptions {
  /** JSX attributes whose value a person reads or hears. Default: {@link DEFAULT_COPY_ATTRIBUTE}. */
  copyAttribute?: RegExp;
}

/**
 * Attributes that carry copy: the ARIA texts, `title`, `placeholder`, `alt`, `label` and any `*Label`
 * prop. `aria-labelledby`, `aria-current` and the other ARIA attributes carry ids and states.
 */
export const DEFAULT_COPY_ATTRIBUTE = /^(?:aria-(?:label|description|placeholder|roledescription|valuetext)|title|placeholder|alt|label|\w+Label)$/;

const LETTER = /\p{L}/u;

/**
 * Every text a person would see in the files' JSX: text between tags, string literals between tags
 * (`{"Save"}`) and literal values of copy attributes. Expressions that are not literals (`{copy.save}`)
 * are not text. Whitespace-only texts are left out.
 */
export function collectVisibleTexts(files: readonly SourceFile[], options: VisibleTextOptions = {}): VisibleText[] {
  const copyAttribute = options.copyAttribute ?? DEFAULT_COPY_ATTRIBUTE;
  return files.flatMap(({ file, source }) => collectFromSource(file, source, copyAttribute));
}

/**
 * The visible texts with a letter in them: copy written into the markup instead of coming from
 * messages or props. Glyphs and punctuation (`·`, `→`, `/`) pass.
 */
export function findInlineCopy(files: readonly SourceFile[], options: VisibleTextOptions = {}): VisibleText[] {
  return collectVisibleTexts(files, options).filter(({ text }) => LETTER.test(stripPlaceholders(text)));
}

/** A phrase that must not appear: a string matches as whole words, ignoring case; a RegExp as written. */
export type ForbiddenPhrase = string | RegExp;

export interface ForbiddenPhraseOptions {
  /** Texts allowed to hold a forbidden phrase: a string matches a file path (exactly or as its end), a RegExp the path. */
  exempt?: readonly (string | RegExp)[];
}

/**
 * The texts that hold a forbidden phrase, each with the phrase it matched: a product vocabulary guard
 * over the visible texts of an app or a message dictionary's values.
 */
export function findForbiddenPhrases(
  texts: readonly VisibleText[],
  phrases: readonly ForbiddenPhrase[],
  options: ForbiddenPhraseOptions = {},
): (VisibleText & { phrase: string })[] {
  const patterns = phrases.map((phrase) => ({ phrase: String(phrase), pattern: toPattern(phrase) }));
  const exempt = options.exempt ?? [];
  return texts
    .filter(({ file }) => !exempt.some((entry) => (typeof entry === "string" ? file === entry || file.endsWith(`/${entry}`) : entry.test(file))))
    .flatMap((text) => patterns.filter(({ pattern }) => pattern.test(text.text)).map(({ phrase }) => ({ ...text, phrase })));
}

function toPattern(phrase: ForbiddenPhrase): RegExp {
  if (typeof phrase !== "string") return new RegExp(phrase.source, phrase.flags.replace("g", ""));
  const escaped = phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
}

function stripPlaceholders(text: string): string {
  return text.replace(/\$\{[^}]*\}/g, "");
}

function collectFromSource(fileName: string, source: string, copyAttribute: RegExp): VisibleText[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: VisibleText[] = [];
  const add = (node: ts.Node, attribute: string | null, text: string) => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
    found.push({ file: fileName, line, attribute, text: trimmed });
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) add(node, null, node.text.replace(/\s+/g, " "));
    if (ts.isJsxExpression(node) && node.expression !== undefined && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      const text = readLiteral(node.expression, file);
      if (text !== null) add(node, null, text);
    }
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(file);
      const value = node.initializer;
      const literal = value !== undefined && ts.isJsxExpression(value) ? value.expression : value;
      const text = literal === undefined ? null : readLiteral(literal, file);
      if (text !== null && copyAttribute.test(name)) add(node, name, text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** The text of a string or template literal, or null for any other expression. */
function readLiteral(node: ts.Expression, file: ts.SourceFile): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.getText(file).slice(1, -1);
  return null;
}
