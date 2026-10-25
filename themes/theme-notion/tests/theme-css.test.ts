import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildThemeStylesheet, parseThemePackageConfig, type ThemePackageConfig } from "@softure-ai/theme-kit/build";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NOTION_THEME } from "../src/index.js";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));

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

// An app's globals.css: Tailwind, then the theme, compiled by the real Tailwind CLI over the component sources.
beforeAll(() => {
  // Inside the package, so `tw-animate-css` and `tailwindcss` resolve from its node_modules as in an app.
  workDir = mkdtempSync(join(PACKAGE_DIR, ".css-test-"));
  const sources = CONFIG.sources.map((source) => join(PACKAGE_DIR, "src", source));
  writeFileSync(join(workDir, "theme.css"), buildThemeStylesheet({ theme: NOTION_THEME, sources, imports: CONFIG.imports }));
  writeFileSync(join(workDir, "app.css"), '@import "tailwindcss" source(none);\n@import "./theme.css";\n');
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

  it("generates the TabBar's line-tab utilities, the current tab's underline included", () => {
    for (const utility of [".h-control-height", ".text-ui-medium", ".duration-120", ".after\\:h-0\\.5", ".tabular-nums"]) {
      expect([utility, compiled.includes(utility)]).toEqual([utility, true]);
    }
    expect(compiled).toMatch(/\.aria-\\\[current\\=page\\\]\\:after\\:opacity-100/);
  });

  it("generates the side panel's layout variants and its hidden rule", () => {
    for (const utility of [".z-3", ".shadow-menu", "\\[\\&\\[hidden\\]\\]\\:hidden", "max-sm\\:data-\\[layout\\=beside\\]\\:absolute", "data-\\[layout\\=list\\]\\:flex-none"]) {
      expect([utility, compiled.includes(utility)]).toEqual([utility, true]);
    }
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
