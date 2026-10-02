// NFR-3 for the package's own components: colours come from tokens only and copy comes from messages
// only. Raw values belong to src/theme/, copy to src/messages/. (`next/*` imports are an ESLint rule.)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const UI_DIR = join(import.meta.dirname, "../src/ui");
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/;
/** JSX attributes whose value a user sees or hears: `aria-*`, `title`, `placeholder`, `alt`, `label`, `*Label`. */
const COPY_ATTRIBUTE = /^(?:aria-[a-z]+|title|placeholder|alt|label|\w+Label)$/;
/** ARIA attributes that carry tokens or ids, never words. */
const NON_COPY_ARIA = new Set(["aria-hidden", "aria-modal", "aria-haspopup", "aria-live", "aria-atomic", "aria-busy", "aria-current", "aria-invalid", "aria-expanded", "aria-selected", "aria-checked", "aria-pressed", "aria-disabled", "aria-controls", "aria-describedby", "aria-labelledby", "aria-activedescendant", "aria-relevant", "aria-autocomplete", "aria-orientation"]);
const LETTER = /\p{L}/u;

function getSourceFiles(): { file: string; source: string }[] {
  return readdirSync(UI_DIR)
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => ({ file, source: readFileSync(join(UI_DIR, file), "utf8") }));
}

function findRawColors(source: string): string[] {
  return source.split("\n").filter((line) => RAW_COLOR.test(line));
}

/** Text a user would see that is written into the component: JSX text and copy attributes with letters. */
function findInlineCopy(source: string): string[] {
  const file = ts.createSourceFile("component.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxText(node) && LETTER.test(node.text)) found.push(node.text.trim());
    const name = ts.isJsxAttribute(node) ? node.name.getText(file) : "";
    if (ts.isJsxAttribute(node) && COPY_ATTRIBUTE.test(name) && !NON_COPY_ARIA.has(name)) {
      const value = node.initializer;
      const literal =
        value !== undefined && ts.isJsxExpression(value) && value.expression !== undefined ? value.expression : value;
      if (literal !== undefined && (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal) || ts.isTemplateExpression(literal))) {
        if (LETTER.test(literal.getText(file))) found.push(`${name}=${literal.getText(file)}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return found;
}

describe("src/ui", () => {
  it("has components to check", () => {
    expect(getSourceFiles().length).toBeGreaterThan(5);
  });

  it("has no raw colour literal", () => {
    for (const { file, source } of getSourceFiles()) expect(findRawColors(source), file).toEqual([]);
  });

  it("has no inline copy: every visible and ARIA text comes from messages or props", () => {
    for (const { file, source } of getSourceFiles()) expect(findInlineCopy(source), file).toEqual([]);
  });
});

describe("the guards", () => {
  it("catch a planted colour literal", () => {
    expect(findRawColors('const a = "sft:bg-[#ff0000]";\nconst b = "rgb(0 0 0)";')).toHaveLength(2);
    expect(findRawColors('const c = "sft:bg-surface";')).toEqual([]);
  });

  it("catch planted inline copy in text and attributes, but not glyphs or expressions", () => {
    const planted = [
      "const a = <button>Save</button>;",
      'const b = <button aria-label="Close" />;',
      "const c = <input placeholder={'Name'} />;",
      "const d = <img alt={`Logo ${x}`} />;",
      'const e = <IconButton label="Close" />;',
      'const f = <Hint triggerLabel="More" />;',
    ].join("\n");
    expect(findInlineCopy(planted)).toEqual([
      "Save",
      'aria-label="Close"',
      "placeholder='Name'",
      "alt=`Logo ${x}`",
      'label="Close"',
      'triggerLabel="More"',
    ]);
    expect(
      findInlineCopy('const g = <span aria-hidden="true">?</span>;\nconst h = <button aria-label={copy.close} aria-haspopup="listbox">{label}</button>;'),
    ).toEqual([]);
  });
});
