import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildThemeStylesheet, parseThemePackageConfig, type ThemePackageConfig } from "@softure-ai/theme-kit/build";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  BUTTON_VARIANT_LOOK,
  CHART_PIN_LOOK,
  CHECKBOX_LOOK,
  CHECKLIST_LOOK,
  COLOR_FIELD_LOOK,
  DATA_TABLE_LOOK,
  FLAT_PAINT_THEME,
  HINT_LOOK,
  MENU_PANEL_LOOK,
  MODAL_LOOK,
  SEGMENT_ACTIVE_LOOK,
  SEGMENTED_CONTROL_LOOK,
  STEPPER_LOOK,
  SWITCH_TRACK_LOOK,
} from "../src/index.js";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
// The kit's page base and the theme's stylesheets, from their sources, in the order the README gives.
const STYLESHEETS = [
  fileURLToPath(new URL("../src/sft-bridge.css", import.meta.url)),
  fileURLToPath(new URL("../../theme-kit/src/base.css", import.meta.url)),
  fileURLToPath(new URL("../src/page.css", import.meta.url)),
];

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

// Classes an app writes in its own markup.
const APP_CLASSES = ["text-hero", "p-card", "mt-section", "max-w-measure", "h-control-md", "rounded-card", "bg-surface", "text-muted", "transition", "dark:bg-surface"];

let workDir = "";
let compiled = "";

// An app's globals.css: Tailwind, the theme and its stylesheets, compiled by the real Tailwind CLI over the look maps.
beforeAll(() => {
  workDir = mkdtempSync(join(PACKAGE_DIR, ".css-test-"));
  const sources = CONFIG.sources.map((source) => join(PACKAGE_DIR, "src", source));
  writeFileSync(join(workDir, "theme.css"), buildThemeStylesheet({ theme: FLAT_PAINT_THEME, sources, imports: CONFIG.imports }));
  const imports = STYLESHEETS.map((path) => `@import ${JSON.stringify(path)};\n`).join("");
  writeFileSync(
    join(workDir, "app.css"),
    `@import "tailwindcss" source(none);\n@import "./theme.css";\n${imports}@source inline("${APP_CLASSES.join(" ")}");\n`,
  );
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
  it("names the look maps as a source", () => {
    expect(buildThemeStylesheet({ theme: FLAT_PAINT_THEME, ...CONFIG }).split("\n")[0]).toBe('@source "./look";');
  });

  it("generates every class of the look maps without an app source of its own", () => {
    const classes = [BUTTON_VARIANT_LOOK.ink, CHECKBOX_LOOK.frame, SEGMENT_ACTIVE_LOOK, SEGMENTED_CONTROL_LOOK.option, SWITCH_TRACK_LOOK].flatMap((look) => look.split(" "));
    for (const className of ["bg-ink", "text-paper", "peer-checked:bg-accent-fill", "border-line-strong", "peer-aria-invalid:border-debt", "has-checked:bg-surface", "has-focus-visible:outline-accent"]) {
      expect([className, classes.includes(className)]).toEqual([className, true]);
    }
    for (const selector of [".bg-ink", ".text-paper", ".peer-checked\\:bg-accent-fill", ".border-line-strong", ".peer-aria-invalid\\:border-debt", ".has-checked\\:bg-surface", ".has-focus-visible\\:outline-accent"]) {
      expect([selector, compiled.includes(selector)]).toEqual([selector, true]);
    }
  });

  it("generates the state variants of the component look maps", () => {
    for (const className of [
      ...(CHECKLIST_LOOK.marker ?? "").split(" "),
      ...(STEPPER_LOOK.marker ?? "").split(" "),
      ...(MENU_PANEL_LOOK.panel ?? "").split(" "),
      ...(COLOR_FIELD_LOOK.preset ?? "").split(" "),
      ...HINT_LOOK.classNames.trigger?.split(" ") ?? [],
    ]) {
      const selector = `.${className.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`)}`;
      expect([selector, compiled.includes(selector)]).toEqual([selector, true]);
    }
  });

  it("generates the chart look maps, the pin line as the package's dash colour", () => {
    expect(compiled).toMatch(/\.rounded-flag \{\s*border-radius: 4px;/);
    for (const selector of [".bg-lime-deep", ".bg-accent-fill", ".text-on-accent", ".size-2\\.5", ".border-paper", ".text-\\[0\\.6875rem\\]"]) {
      expect([selector, compiled.includes(selector)]).toEqual([selector, true]);
    }
    expect(CHART_PIN_LOOK.line.paper.startsWith("[--sft-chart-pin-line:")).toBe(true);
    expect(compiled).toContain("--sft-chart-pin-line: color-mix(in oklab,var(--sft-chart-axis) 70%,transparent);");
  });

  it("generates the data table's classes from the look maps", () => {
    expect(compiled).toMatch(/\.h-touch \{\s*height: 44px;/);
    expect(compiled).toMatch(/\.text-caption \{\s*font-size: 0\.75rem;/);
    expect(compiled).toMatch(/\.bg-surface-raised \{\s*background-color: var\(--surface-raised\);/);
    expect(compiled).toMatch(/\.shadow-selected-row \{\s*--tw-shadow: var\(--shadow-selected-row\);/);
    expect(compiled).toContain(".last\\:font-bold:last-child {");
    expect(compiled).toContain(".\\[\\&\\>\\:first-child\\]\\:font-bold > :first-child {");
    expect(compiled).toMatch(/\.sticky \{\s*position: sticky;/);
    expect(compiled).toMatch(/\.bg-inherit \{\s*background-color: inherit;/);
    expect(compiled).toContain("inset 1px 0 0 var(--tw-shadow-color, var(--border))");
    expect(compiled).toMatch(/@media \(width >= 80rem\) \{\s*\.xl\\:shadow-none \{\s*--tw-shadow: 0 0 #0000;/);
    expect(DATA_TABLE_LOOK.stickyColumn.split(" ")).toContain("xl:shadow-none");
  });

  it("frames a product shot on the theme's radius, hairline and paper", () => {
    expect(compiled).toMatch(
      /\.shot-frame \{\s*display: block;\s*width: 100%;\s*border-radius: 12px;\s*box-shadow: var\(--shadow-shot-frame\);\s*object-fit: cover;\s*object-position: top;\s*background-color: var\(--paper\);\s*\}/,
    );
  });

  it("generates the dialog look's utilities from the look maps", () => {
    expect(MODAL_LOOK.overlay?.split(" ")).toContain("bg-ink/60");
    expect(compiled).toMatch(/\.bg-ink\\\/60 \{[^}]*background-color: color-mix\(in oklab, var\(--ink\) 60%, transparent\);/);
    expect(compiled).toMatch(/\.transition-none \{\s*transition-property: none;/);
    expect(compiled).toMatch(/\.shadow-none \{/);
    expect(compiled).toMatch(/\.text-page \{\s*font-size: 1\.875rem;/);
  });

  it("enters a dialog within the motion tokens: the veil, a sheet below 40rem, a fade up from 40rem, a side panel", () => {
    expect(compiled).toMatch(/@keyframes flat-paint-veil-in \{\s*from \{\s*background-color: transparent;/);
    expect(compiled).toMatch(/@keyframes flat-paint-sheet-in \{\s*from \{\s*translate: 0 100%;/);
    expect(compiled).toMatch(/@keyframes flat-paint-rise-in \{\s*from \{\s*opacity: 0;\s*translate: 0 0\.75rem;/);
    expect(compiled).toMatch(/@keyframes flat-paint-side-in \{\s*from \{\s*translate: 100% 0;/);
    expect(compiled).toMatch(/\.veil-enter \{\s*animation: flat-paint-veil-in var\(--duration-base\) var\(--ease-out-soft\) backwards;/);
    expect(compiled).toMatch(/\.dialog-enter \{\s*animation: flat-paint-sheet-in var\(--duration-slow\) var\(--ease-out-soft\) backwards;/);
    expect(compiled).toMatch(/@media \(width >= 40rem\) \{\s*\.dialog-enter \{\s*animation-name: flat-paint-rise-in;/);
    expect(compiled).toMatch(/\.side-panel-enter \{\s*animation: flat-paint-side-in var\(--duration-slow\) var\(--ease-out-soft\) backwards;/);
    expect(compiled).not.toMatch(/@keyframes flat-paint-[a-z-]+ \{[^@]*scale/);
  });

  it("generates the type scale with its line height, weight and tracking", () => {
    expect(compiled).toMatch(/\.text-hero \{\s*font-size: 5\.5rem;\s*line-height: var\(--tw-leading, 0\.92\);\s*letter-spacing: var\(--tw-tracking, -0\.035em\);\s*font-weight: var\(--tw-font-weight, 700\);/);
  });

  it("generates the spacing, size and container tokens as utilities", () => {
    expect(compiled).toMatch(/\.p-card \{\s*padding: 24px;/);
    expect(compiled).toMatch(/\.mt-section \{\s*margin-top: 96px;/);
    expect(compiled).toMatch(/\.max-w-measure \{\s*max-width: 42rem;/);
    expect(compiled).toMatch(/\.h-control-md \{\s*height: 40px;/);
    expect(compiled).toMatch(/\.rounded-card \{\s*border-radius: 12px;/);
  });

  it("paints utilities with the role variables, so a scheme scope switches them", () => {
    expect(compiled).toMatch(/\.bg-surface \{\s*background-color: var\(--surface\);/);
    expect(compiled).toMatch(/\.text-muted \{\s*color: var\(--muted\);/);
  });

  it("gives a bare transition the fast duration and the soft easing", () => {
    expect(compiled).toContain("--default-transition-duration: var(--duration-fast);");
    expect(compiled).toMatch(/\.transition \{[^}]*transition-duration: var\(--tw-duration, var\(--default-transition-duration\)\)/);
  });

  it("points ui's fonts and radii at the theme's values", () => {
    expect(compiled).toContain("--sft-font-sans: Ubuntu, system-ui, sans-serif;");
    expect(compiled).toContain("--sft-radius-card: 12px;");
  });

  it("leaves out Tailwind's default palette", () => {
    expect(compiled).not.toContain("--color-red-500");
  });

  it("compiles dark: to the theme's scheme rule, not to the system setting alone", () => {
    expect(compiled).toMatch(/\.dark\\:bg-surface:where\(\.dark, \.dark \*, \[data-theme="dark"\], \[data-theme="dark"\] \*\)/);
  });
});
