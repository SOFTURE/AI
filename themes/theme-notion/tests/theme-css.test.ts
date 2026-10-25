import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildThemeStylesheet, parseThemePackageConfig, type ThemePackageConfig } from "@softure-ai/theme-kit/build";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NOTION_THEME } from "../src/index.js";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
// The kit's page stylesheets, from its sources: an app imports them as `@softure-ai/theme-kit/<name>.css`.
const KIT_STYLESHEETS = ["base.css", "maplibre.css"].map((name) => fileURLToPath(new URL(`../../theme-kit/src/${name}`, import.meta.url)));

function readConfig(): ThemePackageConfig {
  const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf8")) as { softureTheme?: unknown };
  const parsed = parseThemePackageConfig(manifest.softureTheme);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.config;
}

const CONFIG = readConfig();

function getTailwindCli(): string {
  const manifestPath = createRequire(import.meta.url).resolve("@tailwindcss/cli/package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { bin: { tailwindcss: string } };
  return join(dirname(manifestPath), manifest.bin.tailwindcss);
}

let workDir = "";
let compiled = "";

// An app's globals.css: Tailwind, the theme and the kit's page stylesheets, compiled by the real Tailwind CLI over the component sources.
beforeAll(() => {
  // Inside the package, so `tw-animate-css` and `tailwindcss` resolve from its node_modules as in an app.
  workDir = mkdtempSync(join(PACKAGE_DIR, ".css-test-"));
  const sources = CONFIG.sources.map((source) => join(PACKAGE_DIR, "src", source));
  writeFileSync(join(workDir, "theme.css"), buildThemeStylesheet({ theme: NOTION_THEME, sources, imports: CONFIG.imports }));
  const kitImports = KIT_STYLESHEETS.map((path) => `@import ${JSON.stringify(path)};\n`).join("");
  writeFileSync(join(workDir, "app.css"), `@import "tailwindcss" source(none);\n@import "./theme.css";\n${kitImports}`);
  execFileSync(process.execPath, [getTailwindCli(), "-i", join(workDir, "app.css"), "-o", join(workDir, "out.css")], {
    cwd: workDir,
    stdio: ["ignore", "ignore", "pipe"],
  });
  compiled = readFileSync(join(workDir, "out.css"), "utf8");
});

afterAll(() => {
  if (workDir !== "") rmSync(workDir, { recursive: true, force: true });
});

describe("theme.css in an app's Tailwind", () => {
  it("names the components as sources and imports the animations the components use", () => {
    expect(buildThemeStylesheet({ theme: NOTION_THEME, ...CONFIG }).split("\n").slice(0, 3)).toEqual([
      '@import "tw-animate-css";',
      '@source "./ui";',
      '@source "./notion";',
    ]);
  });

  it("generates the utilities the components use, on the theme's tokens", () => {
    for (const utility of [".bg-field", ".shadow-menu", ".text-page-title", ".rounded-xl", ".bg-green-tag", ".min-h-row-height", ".hover\\:bg-primary-hover"]) {
      expect([utility, compiled.includes(utility)]).toEqual([utility, true]);
    }
    expect(compiled).toMatch(/\.shadow-menu \{[^}]*var\(--shadow-menu\)/);
    expect(compiled).toContain("--primary: #2383e2;");
  });

  it("generates the open and close animations from tw-animate-css", () => {
    expect(compiled).toContain(".animate-in");
  });

  it("leaves out Tailwind's default palette", () => {
    expect(compiled).not.toContain("--color-red-500");
  });

  it("compiles dark: to the theme's scheme rule, not to the system setting alone", () => {
    expect(compiled).toMatch(/\.dark\\:bg-transparent:where\(\.dark, \.dark \*, \[data-theme="dark"\], \[data-theme="dark"\] \*\)/);
  });
});

describe("the kit's page stylesheets after theme.css", () => {
  const sans = NOTION_THEME.fonts.sans;

  it("gives body the theme's background, text colour and sans font, without the browser's margin", () => {
    expect(compiled).toContain(`body {\n    margin: 0;\n    background: var(--background);\n    color: var(--foreground);\n    font-family: ${sans};\n  }`);
  });

  it("gives MapLibre maps the theme's sans font", () => {
    expect(compiled).toContain(`body .maplibregl-map {\n  font-family: ${sans};\n}`);
  });
});
