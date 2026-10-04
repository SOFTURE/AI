// NFR-3 for the blog's markup and styles: no raw colours, no inline copy, Next only in the adapter,
// and a stylesheet rule for every class the components and the renderer write. The pages style
// themselves with `blog-*` classes from `styles.css`, on the --sft-* tokens only.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "../src");
const STYLES = readFileSync(join(import.meta.dirname, "../styles.css"), "utf8");
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/;
// Attributes that carry text a person reads or hears; `aria-labelledby`, `aria-current` and the like
// carry ids and states.
const COPY_ATTRIBUTE = /^(?:aria-(?:label|description|placeholder|roledescription|valuetext)|title|placeholder|alt|label|\w+Label)$/;
const LETTER = /\p{L}/u;
const BLOG_CLASS = /\bblog-[a-z-]+/g;

function readSources(dir: string): { file: string; source: string }[] {
  return readdirSync(join(SRC, dir))
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => ({ file: `${dir}/${file}`, source: readFileSync(join(SRC, dir, file), "utf8") }));
}

function findInlineCopy(source: string): string[] {
  const file = ts.createSourceFile("component.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxText(node) && LETTER.test(node.text)) found.push(node.text.trim());
    if (ts.isJsxAttribute(node) && COPY_ATTRIBUTE.test(node.name.getText(file))) {
      const value = node.initializer;
      const literal = value !== undefined && ts.isJsxExpression(value) && value.expression !== undefined ? value.expression : value;
      if (literal !== undefined && (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal)) && LETTER.test(literal.text)) {
        found.push(`${node.name.getText(file)}=${literal.text}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return found;
}

/** Class names in `class="…"` (renderer HTML strings) and `className="…"` (components). */
function findClassNames(source: string): string[] {
  return [...source.matchAll(/class(?:Name)?=\\?"([^"\\]*)/g)].flatMap((match) => (match[1] ?? "").match(BLOG_CLASS) ?? []);
}

const markup = [...readSources("ui"), ...readSources("next")];

describe("blog markup and styles", () => {
  it("has components to check", () => {
    expect(markup.filter(({ file }) => file.endsWith(".tsx")).length).toBeGreaterThanOrEqual(5);
  });

  it("has no raw colour literal in markup or styles", () => {
    for (const { file, source } of markup) expect(source.split("\n").filter((line) => RAW_COLOR.test(line)), file).toEqual([]);
    expect(STYLES.split("\n").filter((line) => RAW_COLOR.test(line))).toEqual([]);
  });

  it("has no inline copy: every visible and ARIA text comes from messages", () => {
    for (const { file, source } of markup) expect(findInlineCopy(source), file).toEqual([]);
  });

  it("keeps Next.js out of the components, the page logic, discovery and the proxy piece", () => {
    for (const { file, source } of [...readSources("ui"), ...readSources("pages"), ...readSources("discovery"), ...readSources("proxy")]) {
      expect(source, file).not.toMatch(/from "next(?:\/[a-z]+)?"/);
    }
  });

  it("reaches the optional @softure-ai/seo only through a dynamic import, and the Next adapter only lazily from the root entry", () => {
    const sources = [...readSources(""), ...readSources("discovery"), ...readSources("cli"), ...readSources("server"), ...readSources("next")];
    for (const { file, source } of sources) expect(source, file).not.toMatch(/^import [^;]*from "@softure-ai\/seo/m);
    for (const { file, source } of readSources("")) expect(source, file).not.toMatch(/^import [^;]*from "\.\/next\//m);
  });

  it("styles every blog class the components and the renderer write", () => {
    const used = new Set([...markup, ...readSources("render")].flatMap(({ source }) => findClassNames(source)));
    expect(used.size).toBeGreaterThan(30);
    const missing = [...used].filter((name) => !new RegExp(`\\.${name}(?![a-z-])`).test(STYLES));
    expect(missing).toEqual([]);
  });

  it("keeps every rule in the softure layer, on tokens", () => {
    expect(STYLES.trimEnd().endsWith("}")).toBe(true);
    expect(STYLES.indexOf("@layer softure {")).toBeLessThan(STYLES.indexOf(".blog-"));
    expect(STYLES).toContain("var(--sft-color-foreground)");
  });
});
