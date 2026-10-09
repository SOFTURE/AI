import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  collectVisibleTexts,
  findForbiddenPhrases,
  findInlineCopy,
  findLines,
  findRawColors,
  readImports,
  readSourceFiles,
  type SourceFile,
} from "@softure-ai/testing/guards";

function sourceOf(source: string, file = "component.tsx"): SourceFile[] {
  return [{ file, source }];
}

describe("readSourceFiles", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "softure-guards-"));
    for (const [path, text] of [
      ["ui/button.tsx", "a"],
      ["ui/nested/icon.tsx", "b"],
      ["ui/button.test.tsx", "c"],
      ["ui/styles.css", "d"],
      ["next/page.ts", "e"],
      ["next/node_modules/dep/index.ts", "f"],
      ["index.ts", "g"],
    ] as const) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), text);
    }
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("reads .ts and .tsx files recursively, without tests and node_modules, sorted by path", () => {
    expect(readSourceFiles(root)).toEqual([
      { file: "index.ts", source: "g" },
      { file: "next/page.ts", source: "e" },
      { file: "ui/button.tsx", source: "a" },
      { file: "ui/nested/icon.tsx", source: "b" },
    ]);
  });

  it("reads only the given folders, with paths relative to the root", () => {
    expect(readSourceFiles(root, { dirs: ["ui"] }).map(({ file }) => file)).toEqual(["ui/button.tsx", "ui/nested/icon.tsx"]);
  });

  it("reads only the files directly in the folders when not recursive", () => {
    expect(readSourceFiles(root, { recursive: false }).map(({ file }) => file)).toEqual(["index.ts"]);
    expect(readSourceFiles(root, { dirs: ["ui"], recursive: false }).map(({ file }) => file)).toEqual(["ui/button.tsx"]);
  });

  it("takes another file pattern", () => {
    expect(readSourceFiles(root, { dirs: ["ui"], include: /\.css$/ })).toEqual([{ file: "ui/styles.css", source: "d" }]);
  });

  it("fails on a folder that does not exist, so a moved folder cannot pass the guard empty", () => {
    expect(() => readSourceFiles(root, { dirs: ["gone"] })).toThrow(/ENOENT/);
  });
});

describe("findRawColors and findLines", () => {
  it("report each line with a colour literal as file:line: text", () => {
    const files = sourceOf('const a = "sft:bg-[#ff0000]";\nconst b = "sft:bg-surface";\n  stroke: rgb(0 0 0);\nconst c = oklch(0.5 0.1 200);');
    expect(findRawColors(files)).toEqual(['component.tsx:1: const a = "sft:bg-[#ff0000]";', "component.tsx:3: stroke: rgb(0 0 0);", "component.tsx:4: const c = oklch(0.5 0.1 200);"]);
  });

  it("find nothing in token-only code", () => {
    expect(findRawColors(sourceOf('const a = "sft:bg-surface var(--sft-color-accent)";'))).toEqual([]);
  });

  it("match a global pattern on every line, not every other one", () => {
    expect(findLines(sourceOf("x\nx\nx"), /x/g)).toHaveLength(3);
  });
});

describe("readImports", () => {
  it("lists static, side-effect, type, re-export and literal dynamic imports in source order", () => {
    const source = [
      'import { a } from "./a.js";',
      'import type { B } from "b";',
      "import {",
      "  c,",
      '} from "next/server";',
      'import d, { e } from "d";',
      'import * as f from "f";',
      'import "./styles.css";',
      'export { g } from "./g.js";',
      'export * from "./h.js";',
      'const i = await import("i");',
      "export interface J { name: string }",
      'const k = "import from \\"nowhere\\"";',
    ].join("\n");
    expect(readImports(source)).toEqual(["./a.js", "b", "next/server", "d", "f", "./styles.css", "./g.js", "./h.js", "i"]);
  });

  it("finds no import in a file without one", () => {
    expect(readImports("export const a = 1;\nexport function b() { return a; }")).toEqual([]);
  });
});

describe("collectVisibleTexts", () => {
  it("collects text between tags, string children and copy attributes, with their lines", () => {
    const source = [
      "const a = <button>Save</button>;",
      'const b = <button aria-label="Close" />;',
      "const c = <input placeholder={'Name'} />;",
      "const d = <img alt={`Logo ${x}`} />;",
      'const e = <IconButton label="Close" />;',
      'const f = <Hint triggerLabel="More" />;',
      'const g = <p>{"Inline"}</p>;',
      'const h = <span aria-hidden="true" className="sft:text-muted">·</span>;',
    ].join("\n");
    expect(collectVisibleTexts(sourceOf(source))).toEqual([
      { file: "component.tsx", line: 1, attribute: null, text: "Save" },
      { file: "component.tsx", line: 2, attribute: "aria-label", text: "Close" },
      { file: "component.tsx", line: 3, attribute: "placeholder", text: "Name" },
      { file: "component.tsx", line: 4, attribute: "alt", text: "Logo ${x}" },
      { file: "component.tsx", line: 5, attribute: "label", text: "Close" },
      { file: "component.tsx", line: 6, attribute: "triggerLabel", text: "More" },
      { file: "component.tsx", line: 7, attribute: null, text: "Inline" },
      { file: "component.tsx", line: 8, attribute: null, text: "·" },
    ]);
  });

  it("skips expressions, ids, states and whitespace", () => {
    const source = [
      "const a = <button aria-label={copy.close} aria-haspopup=\"listbox\" aria-labelledby=\"title\">{label}</button>;",
      'const b = <div aria-current="page" className="card" id="main">',
      "  {items}",
      "</div>;",
      'const c = <p>{cond ? "yes" : "no"}</p>;',
    ].join("\n");
    expect(collectVisibleTexts(sourceOf(source))).toEqual([]);
  });

  it("joins text broken over lines with single spaces", () => {
    expect(collectVisibleTexts(sourceOf("const a = <p>\n  Read the\n  terms\n</p>;")).map(({ text }) => text)).toEqual(["Read the terms"]);
  });

  it("takes another set of copy attributes", () => {
    expect(collectVisibleTexts(sourceOf('const a = <Card heading="Plans" title="Ignored" />;'), { copyAttribute: /^heading$/ })).toEqual([
      { file: "component.tsx", line: 1, attribute: "heading", text: "Plans" },
    ]);
  });
});

describe("findInlineCopy", () => {
  it("keeps texts with a letter and passes glyphs, numbers and placeholders", () => {
    const source = 'const a = <p>Save</p>;\nconst b = <span>·</span>;\nconst c = <span>{"→ 2"}</span>;\nconst d = <img alt={`${name}`} />;\nconst e = <p>Größe</p>;';
    expect(findInlineCopy(sourceOf(source)).map(({ text }) => text)).toEqual(["Save", "Größe"]);
  });
});

describe("findForbiddenPhrases", () => {
  const texts = collectVisibleTexts([
    ...sourceOf("const a = <p>Start your free trial</p>;\nconst b = <p>Trials end soon</p>;", "app/pricing.tsx"),
    ...sourceOf('const c = <Button label="Free Trial" />;', "app/legal/terms.tsx"),
  ]);

  it("reports each text with the phrase it holds, as whole words and ignoring case", () => {
    expect(findForbiddenPhrases(texts, ["free trial", "trial"])).toEqual([
      { file: "app/pricing.tsx", line: 1, attribute: null, text: "Start your free trial", phrase: "free trial" },
      { file: "app/pricing.tsx", line: 1, attribute: null, text: "Start your free trial", phrase: "trial" },
      { file: "app/legal/terms.tsx", line: 1, attribute: "label", text: "Free Trial", phrase: "free trial" },
      { file: "app/legal/terms.tsx", line: 1, attribute: "label", text: "Free Trial", phrase: "trial" },
    ]);
  });

  it("takes a RegExp as written", () => {
    expect(findForbiddenPhrases(texts, [/Trials?\b/]).map(({ text }) => text)).toEqual(["Trials end soon", "Free Trial"]);
  });

  it("leaves out exempt files, by path end or RegExp", () => {
    expect(findForbiddenPhrases(texts, ["free trial"], { exempt: ["legal/terms.tsx"] }).map(({ file }) => file)).toEqual(["app/pricing.tsx"]);
    expect(findForbiddenPhrases(texts, ["free trial"], { exempt: [/^app\/legal\//] }).map(({ file }) => file)).toEqual(["app/pricing.tsx"]);
    expect(findForbiddenPhrases(texts, ["free trial"], { exempt: ["terms"] })).toHaveLength(2);
  });

  it("finds nothing when no text holds a phrase", () => {
    expect(findForbiddenPhrases(texts, ["subscription"])).toEqual([]);
  });
});
