import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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

  it("has a rule inside the softure layer for every class the theme switch renders", () => {
    const layer = getSoftureLayer(styles);
    const html = renderToStaticMarkup(createElement(theme.ThemeSwitch));
    const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap(([, list]) => (list ?? "").split(" ")));
    expect(classes.size).toBeGreaterThan(10);
    for (const className of classes) {
      const selector = `.${className.replace(/[:()[\]]/g, "\\$&")}`;
      expect(layer, className).toContain(selector);
    }
  });

  it("generates prefixed utilities only", () => {
    const selectors = [...getSoftureLayer(styles).matchAll(/(?:^|[}{])\.([^{:\\]+)[{:\\]/g)].map(([, name]) => name);
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
    const mapped = [...theme.SCHEME_TOKENS, ...theme.SHARED_TOKENS].filter((name) => !name.startsWith("duration-"));
    for (const name of mapped) expect(bridge, name).toContain(`: var(--sft-${name});`);
  });
});
