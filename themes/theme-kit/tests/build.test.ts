import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildThemeCss } from "../src/index.js";
import { buildThemePackage, buildThemeStylesheet, parseThemePackageConfig } from "../src/build/index.js";
import { runThemeCssCommand } from "../src/cli/command.js";
import { createCompleteTheme } from "./support/complete-theme.js";

describe("parseThemePackageConfig", () => {
  it("reads sources, imports and stylesheets, each defaulting to none", () => {
    expect(parseThemePackageConfig({ sources: ["./ui", "./notion/parts"], imports: ["tw-animate-css"] })).toEqual({
      ok: true,
      config: { sources: ["./ui", "./notion/parts"], imports: ["tw-animate-css"], stylesheets: [] },
    });
  });

  it("refuses a missing value, an unknown key and a path that leaves the package", () => {
    expect([
      parseThemePackageConfig(undefined),
      parseThemePackageConfig({ source: ["./ui"] }),
      parseThemePackageConfig({ sources: ["../ui"] }),
      parseThemePackageConfig({ stylesheets: ["bridge.scss"] }),
      parseThemePackageConfig({ imports: "tw-animate-css" }),
    ]).toEqual([
      { ok: false, error: "softureTheme: missing, or not an object" },
      { ok: false, error: "softureTheme: unknown keys source" },
      { ok: false, error: 'softureTheme: "sources" holds "../ui", which is not a relative folder like ./ui' },
      { ok: false, error: 'softureTheme: "stylesheets" holds "bridge.scss", which is not a .css file name in src/' },
      { ok: false, error: 'softureTheme: "imports" is not a list' },
    ]);
  });
});

describe("buildThemeStylesheet", () => {
  it("writes the imports, the sources, then the theme's tokens", () => {
    const theme = createCompleteTheme();
    expect(buildThemeStylesheet({ theme, sources: ["./ui"], imports: ["tw-animate-css"] })).toBe(
      `@import "tw-animate-css";\n@source "./ui";\n\n${buildThemeCss(theme)}`,
    );
  });
});

let packageDir = "";

function writeThemePackage({ softureTheme, tokens }: { softureTheme: unknown; tokens?: string }): void {
  writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: "@softure-ai/theme-test", softureTheme }));
  mkdirSync(join(packageDir, "src"));
  writeFileSync(join(packageDir, "src", "bridge.css"), "[data-page-frame] { --sft-color-accent: var(--primary); }\n");
  if (tokens !== undefined) {
    mkdirSync(join(packageDir, "dist"));
    writeFileSync(join(packageDir, "dist", "tokens.js"), tokens);
  }
}

beforeEach(() => {
  packageDir = mkdtempSync(join(tmpdir(), "theme-package-"));
});

afterEach(() => {
  rmSync(packageDir, { recursive: true, force: true });
});

describe("buildThemePackage", () => {
  it("writes theme.css from the built theme and copies the declared stylesheets", async () => {
    const theme = createCompleteTheme();
    writeThemePackage({
      softureTheme: { sources: ["./ui"], imports: ["tw-animate-css"], stylesheets: ["bridge.css"] },
      tokens: `export const theme = ${JSON.stringify(theme)};\n`,
    });
    expect(await buildThemePackage(packageDir)).toEqual({ ok: true, files: ["theme.css", "bridge.css"] });
    expect(readFileSync(join(packageDir, "dist", "theme.css"), "utf8")).toBe(
      buildThemeStylesheet({ theme, sources: ["./ui"], imports: ["tw-animate-css"] }),
    );
    expect(readFileSync(join(packageDir, "dist", "bridge.css"), "utf8")).toContain("--sft-color-accent");
  });

  it("refuses a theme that breaks the contract and writes nothing", async () => {
    const colors = Object.fromEntries(Object.entries(createCompleteTheme().colors).filter(([name]) => name !== "ring"));
    writeThemePackage({ softureTheme: {}, tokens: `export const theme = ${JSON.stringify(createCompleteTheme({ name: "Broken", colors }))};\n` });
    expect(await buildThemePackage(packageDir)).toEqual({
      ok: false,
      error: 'theme "Broken" breaks the theme contract: missing shadcn colour roles: ring',
    });
    expect(existsSync(join(packageDir, "dist", "theme.css"))).toBe(false);
  });

  it("refuses a package whose tokens module has no theme export", async () => {
    writeThemePackage({ softureTheme: {}, tokens: "export const NOTION_THEME = {};\n" });
    expect(await buildThemePackage(packageDir)).toEqual({
      ok: false,
      error: `${join(packageDir, "dist", "tokens.js")} does not export \`theme\` as a theme definition`,
    });
  });
});

describe("softure-theme-css", () => {
  it("exits 1 and says why when the package is not built yet", async () => {
    writeThemePackage({ softureTheme: {} });
    const errors: string[] = [];
    const code = await runThemeCssCommand({ argv: [packageDir], cwd: "/", writeError: (line) => errors.push(line) });
    expect([code, errors.length, errors[0]?.startsWith(`softure-theme-css: cannot load ${join(packageDir, "dist", "tokens.js")} (run tsc first)`)]).toEqual([1, 1, true]);
  });

  it("exits 0 and names the written files", async () => {
    writeThemePackage({ softureTheme: {}, tokens: `export const theme = ${JSON.stringify(createCompleteTheme())};\n` });
    const lines: string[] = [];
    const code = await runThemeCssCommand({ argv: [], cwd: packageDir, write: (line) => lines.push(line) });
    expect([code, lines]).toEqual([0, [`softure-theme-css: theme.css in ${join(packageDir, "dist")}`]]);
  });

  it("refuses more than one argument with the usage", async () => {
    const errors: string[] = [];
    expect(await runThemeCssCommand({ argv: ["a", "b"], cwd: "/", writeError: (line) => errors.push(line) })).toBe(1);
    expect(errors).toEqual(["Usage: softure-theme-css [packageDir]   (default: the current folder, after tsc)"]);
  });
});
