import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCss, LAYER_ORDER, SIZE_BUDGET_BYTES } from "../scripts/build-css.mjs";
import * as theme from "../src/index.js";

const outDir = mkdtempSync(join(tmpdir(), "softure-ui-css-"));
let gzipBytes = 0;
let styles = "";
let bridge = "";

beforeAll(() => {
  ({ gzipBytes } = buildCss({ outDir, theme }));
  styles = readFileSync(join(outDir, "styles.css"), "utf8");
  bridge = readFileSync(join(outDir, "tailwind.css"), "utf8");
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

const UI_DIR = join(import.meta.dirname, "../src/ui");

/** Every `sft:` class written in the components' sources. */
function getComponentClasses(): Set<string> {
  const classes = new Set<string>();
  for (const file of readdirSync(UI_DIR).filter((name) => /\.tsx?$/.test(name))) {
    const source = readFileSync(join(UI_DIR, file), "utf8");
    for (const [className] of source.matchAll(/\bsft:[^\s"'`]+/g)) classes.add(className);
  }
  return classes;
}

/** `group` and `peer` mark an element for variants of others and compile to no rule of their own. */
function isMarkerClass(className: string): boolean {
  return /^sft:(?:group|peer)(?:\/[\w-]+)?$/.test(className);
}

/** Whether the CSS has a selector for exactly this class (not merely for a longer one it prefixes). */
function hasSelector(css: string, className: string): boolean {
  const selector = `.${escapeClassName(className)}`;
  let index = css.indexOf(selector);
  while (index !== -1) {
    if (/[\s{:,).[>+~]/.test(css.charAt(index + selector.length))) return true;
    index = css.indexOf(selector, index + 1);
  }
  return false;
}

/** A class name as a CSS selector writes it (the `CSS.escape` rules Tailwind follows). */
function escapeClassName(className: string): string {
  return [...className]
    .map((char, index) => {
      if (/[a-zA-Z_-]/.test(char) || (/\d/.test(char) && index > 0)) return char;
      if (/\d/.test(char)) return `\\${char.charCodeAt(0).toString(16)} `;
      return `\\${char}`;
    })
    .join("");
}

/** Layer names in the order the stylesheet declares them, first declaration wins. */
function getLayerOrder(css: string): string[] {
  const names: string[] = [];
  for (const [, list] of css.matchAll(/@layer ([a-z, ]+)[;{]/g)) {
    for (const name of (list ?? "").split(",").map((part) => part.trim())) {
      if (!names.includes(name)) names.push(name);
    }
  }
  return names;
}

/** The body of the `@layer softure { … }` block, by brace matching. */
function getSoftureLayer(css: string): string {
  const start = css.indexOf("@layer softure{") + "@layer softure{".length;
  let depth = 1;
  let index = start;
  while (depth > 0 && index < css.length) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") depth -= 1;
    index += 1;
  }
  return css.slice(start, index - 1);
}

describe("styles.css", () => {
  it("declares softure above the app's resets and below its components and utilities", () => {
    expect(LAYER_ORDER).toBe("@layer theme, base, softure, components, utilities;");
    expect(getLayerOrder(styles).filter((name) => name !== "properties")).toEqual([
      "theme",
      "base",
      "softure",
      "components",
      "utilities",
    ]);
  });

  it("holds every default token inside the softure layer", () => {
    const layer = getSoftureLayer(styles);
    for (const name of [...theme.SCHEME_TOKENS, ...theme.SHARED_TOKENS]) {
      expect(layer, name).toContain(`--sft-${name}:`);
    }
    expect(layer).toContain("[data-theme=dark]");
    expect(layer).toContain("prefers-color-scheme:dark");
  });

  it("has a rule inside the softure layer for every class the components use", () => {
    // A utility without a theme value compiles to nothing and no markup test notices, so every
    // `sft:` class written in src/ui must have a selector in the compiled CSS.
    const layer = getSoftureLayer(styles);
    const classes = getComponentClasses();
    expect(classes.size).toBeGreaterThan(100);
    const missing = [...classes].filter((className) => !isMarkerClass(className) && !hasSelector(layer, className));
    expect(missing).toEqual([]);
  });

  it("renders the theme switch with classes the scan covers", () => {
    const html = renderToStaticMarkup(createElement(theme.ThemeSwitch));
    const rendered = [...html.matchAll(/class="([^"]+)"/g)].flatMap(([, list]) => (list ?? "").split(" "));
    // Compared in the markup's escaped form: escaping the scan is one-way, so nothing is decoded twice.
    const scanned = new Set([...getComponentClasses()].map((className) => className.replaceAll("&", "&amp;").replaceAll(">", "&gt;")));
    expect(rendered.filter((className) => !scanned.has(className))).toEqual([]);
  });

  it("generates prefixed utilities only", () => {
    const selectors = [...getSoftureLayer(styles).matchAll(/(?:^|[}{])\.([^{:\\]+)[{:\\]/g)].map(([, name]) => name);
    expect(selectors.length).toBeGreaterThan(10);
    expect(selectors.filter((name) => name !== "sft")).toEqual([]);
  });

  it(`stays within the NFR-7 budget of ${SIZE_BUDGET_BYTES / 1024} kB gzip`, () => {
    expect(gzipBytes).toBeGreaterThan(0);
    expect(gzipBytes).toBeLessThanOrEqual(SIZE_BUDGET_BYTES);
  });
});

describe("tailwind.css", () => {
  it("maps every colour, font, text, radius, space, shadow and ease token for the app's Tailwind", () => {
    expect(bridge.startsWith("@theme inline {")).toBe(true);
    // Durations have no Tailwind namespace; chart tokens are read by @softure-ai/charts/styles.css, not by utilities.
    const mapped = [...theme.SCHEME_TOKENS, ...theme.SHARED_TOKENS].filter(
      (name) => !name.startsWith("duration-") && !name.startsWith("chart-"),
    );
    for (const name of mapped) expect(bridge, name).toContain(`: var(--sft-${name});`);
  });
});
