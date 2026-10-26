import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildThemeCss } from "../src/index.js";
import {
  buildKitStylesheetReexport,
  buildThemePackage,
  buildThemeStylesheet,
  KIT_STYLESHEETS,
  parseThemePackageConfig,
} from "../src/build/index.js";
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

  it("refuses a stylesheet named like one of the kit's, which its re-export would overwrite", () => {
    expect(parseThemePackageConfig({ stylesheets: ["bridge.css", "base.css", "preflight.css"] })).toEqual({
      ok: false,
      error: 'softureTheme: "stylesheets" holds base.css, preflight.css, which the kit\'s re-exports take',
    });
  });
});

describe("buildKitStylesheetReexport", () => {
  it("imports the kit's stylesheet by its package name", () => {
    expect(buildKitStylesheetReexport("base.css")).toBe(
      "/* The kit's base.css, resolved from this theme's own dependency on @softure-ai/theme-kit. */\n@import \"@softure-ai/theme-kit/base.css\";\n",
    );
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
  it("writes theme.css from the built theme, copies the declared stylesheets and re-exports the kit's", async () => {
    const theme = createCompleteTheme();
    writeThemePackage({
      softureTheme: { sources: ["./ui"], imports: ["tw-animate-css"], stylesheets: ["bridge.css"] },
      tokens: `export const theme = ${JSON.stringify(theme)};\n`,
    });
    expect(await buildThemePackage(packageDir)).toEqual({
      ok: true,
      files: ["theme.css", "bridge.css", "preflight.css", "base.css", "maplibre.css"],
    });
    expect(readFileSync(join(packageDir, "dist", "theme.css"), "utf8")).toBe(
      buildThemeStylesheet({ theme, sources: ["./ui"], imports: ["tw-animate-css"] }),
    );
    expect(readFileSync(join(packageDir, "dist", "bridge.css"), "utf8")).toContain("--sft-color-accent");
    expect(KIT_STYLESHEETS.map((name) => readFileSync(join(packageDir, "dist", name), "utf8"))).toEqual(
      KIT_STYLESHEETS.map((name) => buildKitStylesheetReexport(name)),
    );
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
    expect([code, lines]).toEqual([0, [`softure-theme-css: theme.css, preflight.css, base.css, maplibre.css in ${join(packageDir, "dist")}`]]);
  });

  it("refuses more than one argument with the usage", async () => {
    const errors: string[] = [];
    expect(await runThemeCssCommand({ argv: ["a", "b"], cwd: "/", writeError: (line) => errors.push(line) })).toBe(1);
    expect(errors).toEqual(["Usage: softure-theme-css [packageDir]   (default: the current folder, after tsc)"]);
  });
});

const KIT_DIR = fileURLToPath(new URL("..", import.meta.url));

function getTailwindCli(): string {
  const manifestPath = createRequire(import.meta.url).resolve("@tailwindcss/cli/package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { bin: { tailwindcss: string } };
  return join(dirname(manifestPath), manifest.bin.tailwindcss);
}

/** Writes a package folder whose `package.json` exports each given file at `./<name>`. */
function writePackage(dir: string, name: string, files: Record<string, string>): void {
  mkdirSync(join(dir, "dist"), { recursive: true });
  const exports = Object.fromEntries(Object.keys(files).map((file) => [`./${file}`, `./dist/${file}`]));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, exports }));
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, "dist", file), text);
}

describe("a theme's re-exported kit stylesheet in an app's Tailwind", () => {
  let appDir = "";

  afterEach(() => {
    if (appDir !== "") rmSync(appDir, { recursive: true, force: true });
  });

  // A strict layout (pnpm, a nested second version): the kit sits only in the theme's own node_modules, so the app
  // cannot import it and the theme's re-export must resolve it from the theme's folder.
  it("resolves the kit from the theme's own dependency, which the app never declared", () => {
    // Inside the kit, so `tailwindcss` resolves from the workspace as in an app.
    appDir = mkdtempSync(join(KIT_DIR, ".css-test-"));
    const themeDir = join(appDir, "node_modules", "@softure-ai", "theme-test");
    const reexports = Object.fromEntries(KIT_STYLESHEETS.map((name) => [name, buildKitStylesheetReexport(name)]));
    writePackage(themeDir, "@softure-ai/theme-test", reexports);
    const kitSheets = Object.fromEntries(KIT_STYLESHEETS.map((name) => [name, readFileSync(join(KIT_DIR, "src", name), "utf8")]));
    writePackage(join(themeDir, "node_modules", "@softure-ai", "theme-kit"), "@softure-ai/theme-kit", kitSheets);
    const imports = KIT_STYLESHEETS.map((name) => `@import "@softure-ai/theme-test/${name}";\n`).join("");
    writeFileSync(join(appDir, "app.css"), `@import "tailwindcss" source(none);\n${imports}`);
    execFileSync(process.execPath, [getTailwindCli(), "-i", join(appDir, "app.css"), "-o", join(appDir, "out.css")], {
      cwd: appDir,
      stdio: ["ignore", "ignore", "pipe"],
    });
    const compiled = readFileSync(join(appDir, "out.css"), "utf8");
    expect([
      compiled.includes("@import"),
      compiled.includes("border-color: var(--border);"),
      compiled.includes("body .maplibregl-map {\n  font-family: var(--font-sans);\n}"),
      compiled.includes(":where([data-slot], [data-slot] *)"),
    ]).toEqual([false, true, true, true]);
  });
});
