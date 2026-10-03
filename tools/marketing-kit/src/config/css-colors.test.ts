import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { readCssColors } from "./css-colors.js";

/** FIRE_TRACKER's token names, the set MK-1's parser read. */
const NAMES = ["background", "surface", "surface-raised", "border", "foreground", "muted", "accessible", "locked", "debt", "accent"];

function read(css: string, theme: "light" | "dark" = "dark"): Record<string, string> {
  const result = readCssColors(css, NAMES, theme);
  if (!result.ok) throw new Error(result.error);
  return result.colors;
}

/**
 * Brand colours from the app's stylesheet: one source with the landing page.
 *
 * The oracle is literals copied by hand from the stylesheet, not the parser's output: the test must
 * fail when the parser takes a value from the wrong block (e.g. `@media (prefers-contrast: more)`),
 * not only when it finds nothing.
 */
describe("readCssColors", () => {
  const css = `
/* a comment with --background: #ffffff; which is not a declaration */
@media (prefers-contrast: more) {
  :root { --muted: #b0c0d0; }
}
:root {
  --duration-fast: 160ms;
  --background: #0b0f14;
  --surface: #131a23;
  --surface-raised: #1a232e;
  --border: #243040;
  --foreground: #e8eef5;
  --muted: #8296ad;
  --accessible: #34d399;
  --locked: #fbbf24;
  --debt: #f87171;
  --accent: #60a5fa;
}
`;

  it("reads the colours from the top-level :root block", () => {
    expect(read(css)).toEqual({
      background: "#0b0f14",
      surface: "#131a23",
      "surface-raised": "#1a232e",
      border: "#243040",
      foreground: "#e8eef5",
      muted: "#8296ad",
      accessible: "#34d399",
      locked: "#fbbf24",
      debt: "#f87171",
      accent: "#60a5fa",
    });
  });

  it("names the missing token instead of rendering the film in default colours", () => {
    const withoutDebt = css.replace("--debt: #f87171;", "");
    expect(readCssColors(withoutDebt, NAMES, "dark")).toEqual({ ok: false, error: 'no --debt in :root or [data-theme="dark"]' });
  });

  it("refuses a value that is not a colour literal", () => {
    const withMix = css.replace("--accent: #60a5fa;", "--accent: color-mix(in oklab, red 50%, blue);");
    expect(readCssColors(withMix, NAMES, "dark")).toEqual({
      ok: false,
      error: '--accent is "color-mix(in oklab, red 50%, blue)", and the film needs a colour literal (#rrggbb)',
    });
  });

  it("reads past a comment holding a long run of comment openers in linear time", () => {
    const hostile = `/*${"a/*".repeat(100_000)}\n${css}`;
    const started = performance.now();
    expect(read(hostile).accent).toBe("#60a5fa");
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it("drops a comment between declarations", () => {
    const commented = css.replace("--accent: #60a5fa;", "/* --accent: #000000; */ --accent: #60a5fa; /* trailing */");
    expect(read(commented).accent).toBe("#60a5fa");
  });

  it("refuses a stylesheet without a :root block", () => {
    expect(readCssColors("body { color: red; }", NAMES, "dark")).toEqual({ ok: false, error: "the stylesheet has no top-level :root block" });
  });

  it("reads a stylesheet shaped like FIRE_TRACKER's globals.css: the dark theme, references resolved", () => {
    // Oracle: FIRE_TRACKER's parser run on its real globals.css at 58e6c84 gives these values.
    const real = readFileSync(new URL("../../tests/fixtures/globals.css", import.meta.url), "utf8");
    const tokens = read(real);
    expect(Object.keys(tokens)).toEqual(NAMES);
    expect(tokens).toEqual({
      background: "#0c0c0d",
      surface: "#17181a",
      "surface-raised": "#1f2023",
      border: "#2a2c30",
      foreground: "#f2f3f5",
      muted: "#a3a6ad",
      accessible: "#2dd4bf",
      locked: "#fbbf24",
      debt: "#f87171",
      accent: "#cff26b",
    });
  });

  it("reads the dark theme and resolves references to the palette", () => {
    const withThemes = `
:root {
  --ink: #0c0c0d;
  --lime: #cff26b;
  --background: #f6f7f8;
  --surface: #ffffff;
  --surface-raised: #ffffff;
  --border: #e6e7ea;
  --foreground: #16171a;
  --muted: #5b606b;
  --accessible: #047857;
  --locked: #b45309;
  --debt: #b91c1c;
  --accent: #3f7b15;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --background: #111111; }
}
[data-theme="dark"],
.dark-band {
  --background: var(--ink);
  --surface: #17181a;
  --surface-raised: #1f2023;
  --border: #2a2c30;
  --foreground: #f2f3f5;
  --muted: #a3a6ad;
  --accent: var(--lime);
  --accessible: #34d399;
  --locked: #fbbf24;
  --debt: #f87171;
}
`;
    expect(read(withThemes)).toEqual({
      background: "#0c0c0d",
      surface: "#17181a",
      "surface-raised": "#1f2023",
      border: "#2a2c30",
      foreground: "#f2f3f5",
      muted: "#a3a6ad",
      accessible: "#34d399",
      locked: "#fbbf24",
      debt: "#f87171",
      accent: "#cff26b",
    });
  });

  it("reads the light theme from its own block when asked", () => {
    const real = readFileSync(new URL("../../tests/fixtures/globals.css", import.meta.url), "utf8");
    expect(read(real, "light").background).toBe("#f6f7f8");
  });

  it("refuses a token name that could break out of the lookup", () => {
    expect(readCssColors(":root{}", ["a)|(b"], "dark")).toEqual({ ok: false, error: '"a)|(b" is not a custom property name (lowercase letters, digits and hyphens)' });
  });
});
