import { describe, expect, it } from "vitest";
import {
  buildTailwindTheme,
  buildThemeCss,
  DEFAULT_THEME,
  getThemeColors,
  mergeThemes,
  SCHEME_TOKENS,
  type SoftureTheme,
} from "../src/index.js";

/** The declarations of the first rule whose selector is exactly `selector`. */
function readBlock(css: string, selector: string): string | undefined {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return undefined;
  const bodyStart = css.indexOf("{", start) + 1;
  return css.slice(bodyStart, css.indexOf("}", bodyStart));
}

describe("buildThemeCss", () => {
  it("returns an empty string for an empty theme", () => {
    expect(buildThemeCss({})).toBe("");
    expect(buildThemeCss({ light: {}, dark: {}, shared: {} })).toBe("");
  });

  it("writes light values under the light attribute and the light media query, never on bare :root", () => {
    const css = buildThemeCss({ light: { "color-accent": "#123456" } });
    expect(readBlock(css, '[data-theme="light"]')).toContain("--sft-color-accent: #123456;");
    expect(css).toMatch(
      /@media \(prefers-color-scheme: light\) \{\s*:root:not\(\[data-theme="dark"\]\) \{[^}]*--sft-color-accent: #123456;/,
    );
    expect(readBlock(css, ":root")).toBeUndefined();
    expect(css).not.toContain('[data-theme="dark"] {');
  });

  it("writes dark values under the dark attribute and the dark media query", () => {
    const css = buildThemeCss({ dark: { "color-background": "#000000" } });
    expect(readBlock(css, '[data-theme="dark"]')).toContain("--sft-color-background: #000000;");
    expect(css).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{[^}]*--sft-color-background: #000000;/,
    );
  });

  it("sets color-scheme in every scheme block", () => {
    const css = buildThemeCss({ light: { "color-accent": "red" }, dark: { "color-accent": "blue" } });
    expect(readBlock(css, '[data-theme="light"]')).toContain("color-scheme: light;");
    expect(readBlock(css, '[data-theme="dark"]')).toContain("color-scheme: dark;");
  });

  it("writes shared tokens once on :root", () => {
    const css = buildThemeCss({ shared: { "radius-card": "1rem" } });
    expect(readBlock(css, ":root")).toBe("\n  --sft-radius-card: 1rem;\n");
    expect(css).not.toContain("data-theme");
  });

  it("adds a bare :root light fallback only when asked", () => {
    const css = buildThemeCss({ light: { "color-accent": "red" } }, { fallback: true });
    expect(readBlock(css, ":root")).toContain("--sft-color-accent: red;");
  });

  it("writes the complete defaults", () => {
    const css = buildThemeCss(DEFAULT_THEME, { fallback: true });
    for (const name of SCHEME_TOKENS) {
      expect(readBlock(css, '[data-theme="dark"]')).toContain(`--sft-${name}: ${DEFAULT_THEME.dark[name]};`);
    }
    expect(css).toContain("--sft-space-8: 2rem;");
  });

  it.each([["red;} body{display:none"], ["</style><script>"], ["a\nb"], [""], ["url(x) { }"]])(
    "rejects the unsafe value %j and names the token",
    (value) => {
      expect(() => buildThemeCss({ light: { "color-accent": value } })).toThrow(/color-accent/);
    },
  );

  it("rejects a token name outside the contract, and a shared token inside a scheme", () => {
    const unknownName = { light: { "color-brand": "red" } } as unknown as SoftureTheme;
    expect(() => buildThemeCss(unknownName)).toThrow(/color-brand/);
    const misplaced = { dark: { "radius-card": "1rem" } } as unknown as SoftureTheme;
    expect(() => buildThemeCss(misplaced)).toThrow(/radius-card/);
  });
});

describe("mergeThemes", () => {
  it("lets later themes win per token and keeps the rest", () => {
    const merged = mergeThemes(
      { light: { "color-accent": "red", "color-muted": "gray" }, shared: { "radius-card": "1rem" } },
      { light: { "color-accent": "blue" } },
    );
    expect(merged).toEqual({
      light: { "color-accent": "blue", "color-muted": "gray" },
      dark: {},
      shared: { "radius-card": "1rem" },
    });
  });
});

describe("getThemeColors", () => {
  it("takes the background of each scheme, falling back to the defaults", () => {
    expect(getThemeColors({ dark: { "color-background": "#010101" } })).toEqual({
      light: DEFAULT_THEME.light["color-background"],
      dark: "#010101",
    });
  });
});

describe("buildTailwindTheme", () => {
  it("maps tokens onto Tailwind namespaces for the package build", () => {
    const css = buildTailwindTheme({ prefix: "sft" });
    expect(css.startsWith("@theme inline reference prefix(sft) {")).toBe(true);
    expect(css).toContain("--color-accent-fill: var(--sft-color-accent-fill);");
    expect(css).toContain("--spacing-3: var(--sft-space-3);");
    expect(css).toContain("--text-display: var(--sft-text-display);");
    expect(css).toContain("--radius-pill: var(--sft-radius-pill);");
    expect(css).toContain("--shadow-2: var(--sft-shadow-2);");
    expect(css).toContain("--font-heading: var(--sft-font-heading);");
    expect(css).toContain("--ease-out: var(--sft-ease-out);");
    expect(css).not.toContain("duration");
  });

  it("writes the app bridge without prefix or reference", () => {
    const css = buildTailwindTheme();
    expect(css.startsWith("@theme inline {")).toBe(true);
    expect(css).toContain("--color-background: var(--sft-color-background);");
  });
});
