// NFR-3 for the module's own markup: no raw colours, no inline copy, and only classes that
// @softure-ai/ui compiles. The module ships no CSS of its own: ui's styles.css is compiled from
// foundation/ui/src/ui, and its styles test requires a selector for every class written there, so
// a class the module shares with ui is a class that exists. (`next/*` imports are an ESLint rule.)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "../src");
const MARKUP_DIRS = ["ui", "next"].map((dir) => join(SRC, dir));
const UI_PACKAGE_DIR = join(import.meta.dirname, "../../../foundation/ui/src/ui");
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/;
const COPY_ATTRIBUTE = /^(?:aria-[a-z]+|title|placeholder|alt|label|\w+Label)$/;
const LETTER = /\p{L}/u;
const SFT_CLASS = /sft:[^\s"'`]+/g;

function readSources(dirs: readonly string[]): { file: string; source: string }[] {
  return dirs.flatMap((dir) =>
    readdirSync(dir)
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => ({ file, source: readFileSync(join(dir, file), "utf8") })),
  );
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

const sources = readSources(MARKUP_DIRS);
const uiClasses = new Set(readSources([UI_PACKAGE_DIR]).flatMap(({ source }) => source.match(SFT_CLASS) ?? []));

describe("mcp-access markup", () => {
  it("has components to check", () => {
    expect(sources.filter(({ file }) => file.endsWith(".tsx")).length).toBeGreaterThanOrEqual(2);
  });

  it("has no raw colour literal", () => {
    for (const { file, source } of sources) expect(source.split("\n").filter((line) => RAW_COLOR.test(line)), file).toEqual([]);
  });

  it("has no inline copy: every visible and ARIA text comes from messages", () => {
    for (const { file, source } of sources) expect(findInlineCopy(source), file).toEqual([]);
  });

  it("uses only sft: classes that @softure-ai/ui compiles", () => {
    for (const { file, source } of sources) {
      const missing = (source.match(SFT_CLASS) ?? []).filter((name) => !uiClasses.has(name));
      expect(missing, file).toEqual([]);
    }
  });

  it("would catch a class ui does not use", () => {
    expect(uiClasses.has("sft:text-accent")).toBe(true);
    expect(uiClasses.has("sft:text-rainbow")).toBe(false);
  });
});
