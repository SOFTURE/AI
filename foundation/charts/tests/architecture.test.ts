// NFR-3 for the package's components: colours and sizes come from tokens only and copy comes from
// messages or props only. Raw values belong to @softure-ai/ui's tokens, copy to src/messages/.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SCHEME_TOKENS, SHARED_TOKENS } from "@softure-ai/ui";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const PACKAGE_DIR = join(import.meta.dirname, "..");
const COMPONENT_DIRS = ["src/svg", "src/cursor"];
const STYLES = readFileSync(join(PACKAGE_DIR, "styles.css"), "utf8");

const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/;
/** JSX attributes whose value a user sees or hears. */
const COPY_ATTRIBUTE = /^(?:aria-label|aria-description|aria-roledescription|title|placeholder|alt|label|\w+Label)$/;
const LETTER = /\p{L}/u;
/** Custom properties styles.css defines itself, on top of the tokens. */
const LOCAL_PROPERTIES = new Set(["--sft-chart-series", "--sft-chart-axis-width", "--sft-chart-dash", "--sft-chart-dash-gap", "--sft-chart-tone", "--sft-chart-pin-line", "--sft-chart-tint-opacity", "--sft-chart-faded-opacity", "--sft-chart-sankey-label-width"]);

function getComponentSources(): { file: string; source: string }[] {
  return COMPONENT_DIRS.flatMap((dir) =>
    readdirSync(join(PACKAGE_DIR, dir))
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => ({ file: `${dir}/${file}`, source: readFileSync(join(PACKAGE_DIR, dir, file), "utf8") })),
  );
}

function findRawColors(source: string): string[] {
  return source.split("\n").filter((line) => RAW_COLOR.test(line));
}

/** Text a user would see that is written into a component: JSX text and copy attributes with letters. */
function findInlineCopy(source: string): string[] {
  const file = ts.createSourceFile("component.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxText(node) && LETTER.test(node.text)) found.push(node.text.trim());
    if (ts.isJsxAttribute(node) && COPY_ATTRIBUTE.test(node.name.getText(file))) {
      const value = node.initializer;
      const literal = value !== undefined && ts.isJsxExpression(value) && value.expression !== undefined ? value.expression : value;
      if (literal !== undefined && (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal) || ts.isTemplateExpression(literal))) {
        if (LETTER.test(literal.getText(file))) found.push(`${node.name.getText(file)}=${literal.getText(file)}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return found;
}

/** The `--sft-*` custom properties a stylesheet reads (also the first name of a `var()` with a fallback), without the ones it defines itself. */
function findUnknownTokens(css: string): string[] {
  const known = new Set([...SCHEME_TOKENS, ...SHARED_TOKENS].map((name) => `--sft-${name}`));
  const read = [...css.matchAll(/var\((--sft-[a-z0-9-]+)\s*[,)]/g)].map((match) => match[1] ?? "");
  return [...new Set(read)].filter((name) => !known.has(name) && !LOCAL_PROPERTIES.has(name));
}

describe("components", () => {
  it("are there to check", () => {
    expect(getComponentSources().length).toBeGreaterThan(8);
  });

  it("have no raw colour literal", () => {
    for (const { file, source } of getComponentSources()) expect(findRawColors(source), file).toEqual([]);
  });

  it("have no inline copy: every visible and ARIA text comes from messages or props", () => {
    for (const { file, source } of getComponentSources()) expect(findInlineCopy(source), file).toEqual([]);
  });
});

describe("styles.css", () => {
  it("has no raw colour literal", () => {
    expect(findRawColors(STYLES)).toEqual([]);
  });

  it("reads only tokens of @softure-ai/ui, and every chart token", () => {
    expect(findUnknownTokens(STYLES)).toEqual([]);
    const chartTokens = [...SCHEME_TOKENS, ...SHARED_TOKENS].filter((name) => name.startsWith("chart-"));
    for (const name of chartTokens) expect(STYLES, name).toContain(`var(--sft-${name})`);
  });

  it("sits in the softure layer, so the app's classes win", () => {
    expect(STYLES.trim()).toMatch(/^\/\*[\s\S]*?\*\/\s*@layer softure \{[\s\S]*\}$/);
  });
});

describe("the guards", () => {
  it("catch a planted colour literal", () => {
    expect(findRawColors('const a = "#ff0000";\n.x { stroke: rgb(0 0 0); }\nconst b = "sft-chart-grid";')).toHaveLength(2);
  });

  it("catch planted inline copy, but not class names or expressions", () => {
    const planted = ['const a = <span>Savings</span>;', 'const b = <div aria-label="Chart" />;', 'const c = <div className="sft-chart" aria-label={label} />;'].join("\n");
    expect(findInlineCopy(planted)).toEqual(["Savings", 'aria-label="Chart"']);
  });

  it("catch a token that does not exist", () => {
    expect(findUnknownTokens(".x { color: var(--sft-chart-gird); stroke: var(--sft-chart-grid); }")).toEqual(["--sft-chart-gird"]);
    expect(findUnknownTokens(".x { color: var(--sft-chart-pin-lien, var(--sft-chart-cursor)); }")).toEqual(["--sft-chart-pin-lien"]);
  });
});

describe("package manifest", () => {
  const manifest = JSON.parse(readFileSync(join(import.meta.dirname, "../package.json"), "utf8")) as {
    sideEffects: unknown;
    dependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
  };

  it("marks the stylesheet as a side effect, so a JS import of styles.css survives tree shaking", () => {
    expect(manifest.sideEffects).toEqual(["*.css"]);
  });

  it("takes @softure-ai/ui as a peer, so an app has one copy of the tokens and the theme", () => {
    expect(manifest.dependencies["@softure-ai/ui"]).toBeUndefined();
    expect(manifest.peerDependencies["@softure-ai/ui"]).toBe("^0.1.6");
  });
});
