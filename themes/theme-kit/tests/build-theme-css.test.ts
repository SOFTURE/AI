import { describe, expect, it } from "vitest";

import {
  buildThemeCss,
  DEFAULT_DENSITY,
  DENSITIES,
  findMissingColorRoles,
  LIST_DENSITY_VARIABLES,
  SHADCN_COLOR_ROLES,
  type ThemeDefinition,
} from "../src/index.js";

function createDefinition(overrides: Partial<ThemeDefinition> = {}): ThemeDefinition {
  return {
    name: "Test",
    colors: {
      background: { light: "#ffffff", dark: "#191919" },
      blue: { light: "#337ea9", dark: "#379ad3" },
      "chart-1": { alias: "blue" },
    },
    shadows: { menu: { light: "0 1px 2px rgba(0, 0, 0, 0.1)", dark: "0 1px 2px rgba(0, 0, 0, 0.4)" } },
    fonts: { sans: "ui-sans-serif, sans-serif" },
    textStyles: {
      "page-title": { fontSize: "40px", lineHeight: "48px", fontWeight: 700, letterSpacing: "-0.01em" },
      body: { fontSize: "16px", lineHeight: "24px", fontWeight: 400 },
    },
    radii: { md: "6px" },
    sizes: { "sidebar-width": "240px" },
    clearDefaultPalette: true,
    ...overrides,
  };
}

function readBlock(css: string, opening: string): string {
  const start = css.indexOf(`${opening} {`);
  if (start === -1) throw new Error(`no block "${opening}" in:\n${css}`);
  return css.slice(start, css.indexOf("}", start) + 1);
}

describe("buildThemeCss", () => {
  const css = buildThemeCss(createDefinition());

  it("writes the light values on :root and on an explicit light scope", () => {
    expect(readBlock(css, ':root, .light, [data-theme="light"]')).toBe(
      [
        ':root, .light, [data-theme="light"] {',
        "  --background: #ffffff;",
        "  --blue: #337ea9;",
        "  --chart-1: var(--blue);",
        "  --shadow-menu: 0 1px 2px rgba(0, 0, 0, 0.1);",
        "}",
      ].join("\n"),
    );
  });

  it("writes the dark values for the system setting unless the page asks for light, and for an explicit dark scope", () => {
    const dark = ["  --background: #191919;", "  --blue: #379ad3;", "  --shadow-menu: 0 1px 2px rgba(0, 0, 0, 0.4);"];
    expect(css).toContain(
      ['@media (prefers-color-scheme: dark) {', '  :root:not(.light, [data-theme="light"]) {', ...dark.map((line) => `  ${line}`), "  }", "}"].join("\n"),
    );
    expect(readBlock(css, '.dark, [data-theme="dark"]')).toBe(['.dark, [data-theme="dark"] {', ...dark, "}"].join("\n"));
  });

  it("puts the explicit dark scope after the light one, so a dark page in a light system wins by order", () => {
    expect(css.indexOf('.dark, [data-theme="dark"] {')).toBeGreaterThan(css.indexOf(':root, .light, [data-theme="light"] {'));
  });

  it("makes Tailwind's dark: variant follow the same rule as the tokens", () => {
    expect(css).toContain(
      [
        "@custom-variant dark {",
        "  @media (prefers-color-scheme: dark) {",
        '    &:where(:root:not(.light, [data-theme="light"]), :root:not(.light, [data-theme="light"]) *) {',
        "      @slot;",
        "    }",
        "  }",
        '  &:where(.dark, .dark *, [data-theme="dark"], [data-theme="dark"] *) {',
        "    @slot;",
        "  }",
        "}",
      ].join("\n"),
    );
  });

  it("maps every token to a Tailwind utility in @theme inline", () => {
    expect(readBlock(css, "@theme inline")).toBe(
      [
        "@theme inline {",
        "  --color-*: initial;",
        "  --color-background: var(--background);",
        "  --color-blue: var(--blue);",
        "  --color-chart-1: var(--chart-1);",
        "  --font-sans: ui-sans-serif, sans-serif;",
        "  --text-page-title: 40px;",
        "  --text-page-title--line-height: 48px;",
        "  --text-page-title--font-weight: 700;",
        "  --text-page-title--letter-spacing: -0.01em;",
        "  --text-body: 16px;",
        "  --text-body--line-height: 24px;",
        "  --text-body--font-weight: 400;",
        "  --radius-md: 6px;",
        "  --shadow-menu: var(--shadow-menu);",
        "  --spacing-sidebar-width: 240px;",
        "}",
      ].join("\n"),
    );
  });

  it("keeps Tailwind's default palette when the theme does not clear it", () => {
    expect(buildThemeCss(createDefinition({ clearDefaultPalette: false }))).not.toContain("--color-*");
  });

  it("refuses a value that could end the declaration or the block", () => {
    for (const value of ["red; color: blue", "red }", "<style>", "red\n", " "]) {
      expect(() => buildThemeCss(createDefinition({ colors: { background: { light: value, dark: "#000" } } }))).toThrow(
        'buildThemeCss: value of "background" is empty or holds one of ; { } < > or a line break',
      );
    }
  });

  it("refuses a token name that is not kebab-case and an alias of an undefined colour", () => {
    expect(() => buildThemeCss(createDefinition({ radii: { "Big Radius": "9px" } }))).toThrow(
      'buildThemeCss: radius name "Big Radius" is not a lowercase kebab-case name',
    );
    expect(() => buildThemeCss(createDefinition({ colors: { "chart-1": { alias: "teal" } } }))).toThrow(
      'buildThemeCss: colour "chart-1" follows "teal", which the theme does not define',
    );
  });
});

describe("findMissingColorRoles", () => {
  it("lists the shadcn roles a theme lacks, in contract order", () => {
    expect(findMissingColorRoles(createDefinition()).slice(0, 3)).toEqual(["foreground", "card", "card-foreground"]);
  });

  it("is empty for a theme with every role", () => {
    const colors = Object.fromEntries(SHADCN_COLOR_ROLES.map((role) => [role, { light: "#fff", dark: "#000" }]));
    expect(findMissingColorRoles({ colors })).toEqual([]);
  });
});

describe("buildThemeCss list density (#1341)", () => {
  it("writes the kit's default scale: compact on :root and its attribute, roomy on its attribute", () => {
    const css = buildThemeCss(createDefinition());

    expect(readBlock(css, ':root, [data-density="compact"]')).toBe(
      [':root, [data-density="compact"] {', "  --list-row-y: 0.25rem;", "  --list-item-y: 0px;", "  --list-divider-width: 0px;", "}"].join("\n"),
    );
    expect(readBlock(css, '[data-density="roomy"]')).toBe(
      ['[data-density="roomy"] {', "  --list-row-y: 0.5rem;", "  --list-item-y: 0.25rem;", "  --list-divider-width: 1px;", "}"].join("\n"),
    );
  });

  it("writes roomy after compact, so roomy wins on an html element that carries the attribute", () => {
    const css = buildThemeCss(createDefinition());

    expect(css.indexOf('[data-density="roomy"] {')).toBeGreaterThan(css.indexOf(':root, [data-density="compact"] {'));
    expect(css.indexOf('[data-density="roomy"] {')).toBeLessThan(css.indexOf("@theme inline {"));
  });

  it("writes a theme's own scale in place of the default", () => {
    const density = {
      compact: { rowPaddingY: "2px", itemPaddingY: "0px", dividerWidth: "0px" },
      roomy: { rowPaddingY: "12px", itemPaddingY: "6px", dividerWidth: "2px" },
    };
    const css = buildThemeCss(createDefinition({ density }));

    expect(readBlock(css, '[data-density="roomy"]')).toBe(
      ['[data-density="roomy"] {', "  --list-row-y: 12px;", "  --list-item-y: 6px;", "  --list-divider-width: 2px;", "}"].join("\n"),
    );
    expect(readBlock(css, ':root, [data-density="compact"]')).toContain("--list-row-y: 2px;");
  });

  it("refuses a density length that is empty or could break out of the block", () => {
    const density = {
      compact: DEFAULT_DENSITY.compact,
      roomy: { ...DEFAULT_DENSITY.roomy, dividerWidth: "1px; color: red" },
    };

    expect(() => buildThemeCss(createDefinition({ density }))).toThrow(
      'buildThemeCss: value of "density-roomy-dividerWidth" is empty or holds one of ; { } < > or a line break',
    );
  });

  it("names both densities, compact first, and a variable for every length", () => {
    expect(DENSITIES).toEqual(["compact", "roomy"]);
    expect(LIST_DENSITY_VARIABLES).toEqual({ rowPaddingY: "--list-row-y", itemPaddingY: "--list-item-y", dividerWidth: "--list-divider-width" });
    expect(Object.keys(DEFAULT_DENSITY.compact)).toEqual(Object.keys(LIST_DENSITY_VARIABLES));
  });
});
