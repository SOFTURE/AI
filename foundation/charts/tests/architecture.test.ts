// NFR-3 for the package's components: colours and sizes come from tokens only and copy comes from
// messages or props only. Raw values belong to @softure-ai/ui's tokens, copy to src/messages/.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findInlineCopy, findRawColors, readSourceFiles, type SourceFile } from "@softure-ai/testing/guards";
import { SCHEME_TOKENS, SHARED_TOKENS } from "@softure-ai/ui";
import { describe, expect, it } from "vitest";

const PACKAGE_DIR = join(import.meta.dirname, "..");
const STYLES = readFileSync(join(PACKAGE_DIR, "styles.css"), "utf8");
const STYLES_FILE: SourceFile[] = [{ file: "styles.css", source: STYLES }];
/** Custom properties styles.css defines itself, on top of the tokens. */
const LOCAL_PROPERTIES = new Set(["--sft-chart-series", "--sft-chart-axis-width", "--sft-chart-dash", "--sft-chart-dash-gap", "--sft-chart-tone", "--sft-chart-pin-line", "--sft-chart-tint-opacity", "--sft-chart-faded-opacity", "--sft-chart-sankey-label-width"]);

const components = readSourceFiles(PACKAGE_DIR, { dirs: ["src/svg", "src/cursor"] });

/** The `--sft-*` custom properties a stylesheet reads (also the first name of a `var()` with a fallback), without the ones it defines itself. */
function findUnknownTokens(css: string): string[] {
  const known = new Set([...SCHEME_TOKENS, ...SHARED_TOKENS].map((name) => `--sft-${name}`));
  const read = [...css.matchAll(/var\((--sft-[a-z0-9-]+)\s*[,)]/g)].map((match) => match[1] ?? "");
  return [...new Set(read)].filter((name) => !known.has(name) && !LOCAL_PROPERTIES.has(name));
}

describe("components", () => {
  it("are there to check", () => {
    expect(components.length).toBeGreaterThan(8);
  });

  it("have no raw colour literal", () => {
    expect(findRawColors(components)).toEqual([]);
  });

  it("have no inline copy: every visible and ARIA text comes from messages or props", () => {
    expect(findInlineCopy(components)).toEqual([]);
  });
});

describe("styles.css", () => {
  it("has no raw colour literal", () => {
    expect(findRawColors(STYLES_FILE)).toEqual([]);
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

describe("the token guard", () => {
  it("catches a token that does not exist", () => {
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
