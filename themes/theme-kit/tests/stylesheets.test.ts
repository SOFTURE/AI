import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SHADCN_COLOR_ROLES } from "../src/index.js";

function readRules(name: string): string {
  return readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

function readVariables(rules: string): string[] {
  return [...rules.matchAll(/(?:var|--theme)\((--[\w-]+)\)/g)].map((match) => match[1] ?? "");
}

describe("base.css", () => {
  const rules = readRules("base.css");

  it("styles only the universal selector and body, in the base layer, so every component and utility overrides it", () => {
    expect(rules.startsWith("@layer base {")).toBe(true);
    expect([...rules.matchAll(/^\s*([^@\s{}][^{}]*)\{/gm)].map((match) => (match[1] ?? "").replace(/\s+/g, " ").trim())).toEqual([
      "*, ::before, ::after, ::backdrop",
      "body",
    ]);
  });

  it("gives borders the theme's border colour and outlines a half-transparent ring, as shadcn/ui's globals.css does", () => {
    expect(rules).toContain(
      "  *,\n  ::before,\n  ::after,\n  ::backdrop {\n    border-color: var(--border);\n    outline-color: color-mix(in oklab, var(--ring) 50%, transparent);\n  }",
    );
  });

  it("clears the browser's margin and reads only contract colours and the theme's sans font", () => {
    expect(rules).toContain("margin: 0;");
    const colors = readVariables(rules).filter((name) => name !== "--font-sans");
    expect(colors.sort()).toEqual(["--background", "--border", "--foreground", "--ring"]);
    for (const name of colors) expect(SHADCN_COLOR_ROLES).toContain(name.slice(2));
    expect(rules).toContain("font-family: --theme(--font-sans);");
  });
});

describe("maplibre.css", () => {
  const rules = readRules("maplibre.css");

  it("is unlayered and more specific than maplibre-gl.css's .maplibregl-map, so it wins in any load order", () => {
    expect(rules).not.toContain("@layer");
    expect(rules).toBe("body .maplibregl-map {\n  font-family: --theme(--font-sans);\n}");
  });
});

describe("the kit's stylesheets", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { exports: Record<string, unknown> };
  const copyScript = readFileSync(new URL("../scripts/copy-css.mjs", import.meta.url), "utf8");
  const names = readdirSync(new URL("../src/", import.meta.url)).filter((name) => name.endsWith(".css"));

  it("copies every one to dist and exports it", () => {
    expect(names.sort()).toEqual(["base.css", "maplibre.css", "preflight.css"]);
    for (const name of names) {
      expect([name, copyScript.includes(`"${name}"`), manifest.exports[`./${name}`]]).toEqual([name, true, `./dist/${name}`]);
    }
  });
});
