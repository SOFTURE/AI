import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildThemeStylesheet, parseThemePackageConfig, type ThemePackageConfig } from "@softure-ai/theme-kit/build";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FLAT_ATLAS_THEME } from "../src/index.js";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
const STYLESHEETS = [fileURLToPath(new URL("../../theme-kit/src/base.css", import.meta.url)), fileURLToPath(new URL("../src/page.css", import.meta.url))];

function readConfig(): ThemePackageConfig {
  const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf8")) as { softureTheme?: unknown };
  const parsed = parseThemePackageConfig(manifest.softureTheme);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.config;
}

function getTailwindCli(): string {
  const manifestPath = createRequire(import.meta.url).resolve("@tailwindcss/cli/package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { bin: { tailwindcss: string } };
  return join(dirname(manifestPath), manifest.bin.tailwindcss);
}

function toSelector(className: string): string {
  return `.${className.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`)}`;
}

const CONFIG = readConfig();
let workDir = "";
let compiled = "";

// An app's stylesheet: Tailwind, the theme and its page base, compiled by the real Tailwind CLI over the components
// only (the theme's source), with no app source.
beforeAll(() => {
  workDir = mkdtempSync(join(PACKAGE_DIR, ".css-test-"));
  const sources = CONFIG.sources.map((source) => join(PACKAGE_DIR, "src", source));
  writeFileSync(join(workDir, "theme.css"), buildThemeStylesheet({ theme: FLAT_ATLAS_THEME, sources, imports: CONFIG.imports }));
  const imports = STYLESHEETS.map((path) => `@import ${JSON.stringify(path)};\n`).join("");
  writeFileSync(join(workDir, "app.css"), `@import "tailwindcss" source(none);\n@import "./theme.css";\n${imports}`);
  execFileSync(process.execPath, [getTailwindCli(), "-i", join(workDir, "app.css"), "-o", join(workDir, "out.css")], {
    cwd: workDir,
    stdio: ["ignore", "ignore", "pipe"],
  });
  compiled = readFileSync(join(workDir, "out.css"), "utf8");
});

afterAll(() => {
  if (workDir !== "") rmSync(workDir, { recursive: true, force: true });
});

// The classes of the components that lean on the theme's own tokens or on less common variants.
const COMPONENT_CLASSES = [
  "bg-accent-fill",
  "hover:not-disabled:bg-accent-fill-hover",
  "active:not-disabled:scale-97",
  "text-on-accent",
  "border-line-strong",
  "hover:not-disabled:bg-foreground/5",
  "bg-ink",
  "text-paper",
  "h-control-sm",
  "h-control-md",
  "h-control-lg",
  "text-button-sm",
  "text-button-lg",
  "text-label",
  "rounded-control",
  "focus-visible:outline-accent",
  "size-control-md",
  "h-header",
  "text-wordmark",
  "[&_img]:size-mark",
  "md:text-hero",
  "text-display",
  "font-display",
  "h-unit",
  "text-unit",
  "rounded-tag",
  "max-w-counter-bar",
  "rounded-pill",
  "h-chip",
  "h-chip-code",
  "text-iso-sm",
  "border-planned",
  "text-planned",
  "size-touch",
  "size-pin-sm",
  "md:size-pin",
  "group-hover/pin:scale-125",
  "group-focus-visible/pin:outline-accent",
  "border-pin-stroke",
  "bg-place",
  "h-tag",
  "text-tag",
  "text-tag-detail",
  "peer-hover:opacity-100",
  "peer-focus-visible:opacity-100",
  "size-pin-cluster",
  "w-popover",
  "bg-surface-raised",
  "text-place-name",
  "text-meta",
  "text-coord",
  "rounded-swatch",
  "bg-visited",
  "bg-map-land",
  "aspect-4/3",
  "rounded-photo",
  "bg-map-ocean",
  "size-postmark",
  "gap-1.25",
  "-rotate-8",
  "-outline-offset-7",
  "outline-visited",
  "outline-dashed",
  "text-postmark",
  "text-postmark-year",
  "text-subsection",
  "min-w-map-min",
  "fill-map-land",
  "stroke-map-edge",
  "fill-visited",
  "stroke-planned",
  "stroke-[0.6]",
  "[stroke-dasharray:3_2]",
  "stroke-foreground/7",
];

describe("theme.css in an app's Tailwind", () => {
  it("names the components as its source", () => {
    expect(buildThemeStylesheet({ theme: FLAT_ATLAS_THEME, ...CONFIG }).split("\n")[0]).toBe('@source "./atlas";');
  });

  it("generates every component class without an app source of its own", () => {
    const missing = COMPONENT_CLASSES.map(toSelector).filter((selector) => !compiled.includes(selector));
    expect(missing).toEqual([]);
  });

  it("clears Tailwind's palette, so only the theme's roles paint", () => {
    expect(compiled).not.toContain("--color-red-500");
    expect(compiled).toMatch(/\.bg-accent-fill \{\s*background-color: var\(--accent-fill\);/);
  });

  it("writes the passport paper scheme first and the passport cover as dark", () => {
    expect(compiled).toContain("--background: #F3F8F3;");
    expect(compiled).toContain("--background: #141A2E;");
  });

  it("carries the page base: tracking, lining numerals, untracked numbers and reduced motion", () => {
    expect(compiled).toContain("letter-spacing: 0.02em;");
    expect(compiled).toContain("font-variant-numeric: lining-nums;");
    expect(compiled).toMatch(/\.num \{\s*font-variant-numeric: lining-nums tabular-nums;\s*letter-spacing: 0;/);
    expect(compiled).toContain("--duration-base: 220ms;");
    expect(compiled).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("draws no shadow, glow, gradient or blur anywhere", () => {
    expect(compiled).not.toMatch(/\.(shadow|drop-shadow|blur|backdrop|bg-linear|bg-gradient)[\w-]*\s*\{/);
  });
});
