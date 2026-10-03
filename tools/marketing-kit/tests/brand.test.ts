import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveBrandColors } from "../src/config/brand.js";
import { readDesignJsonColors } from "../src/config/design-json.js";
import { marketingSchema, type MarketingJson } from "../src/config/schema.js";

/** The shape of FIRE_TRACKER's `.impeccable/design.json` (schemaVersion 2), trimmed to what matters. */
const FIRE_DESIGN = {
  schemaVersion: 2,
  title: "Design System",
  themes: {
    default: "system",
    light: { roles: { background: "#f6f7f8", foreground: "#16171a", muted: "#5b606b", accent: "#356912", accessible: "#0f766e" } },
    dark: {
      roles: {
        background: "#0c0c0d",
        foreground: "#f2f3f5",
        muted: "#a3a6ad",
        accent: "#cff26b",
        "accent-fill": "#cff26b",
        "on-accent": "#0c0c0d",
        accessible: "#2dd4bf",
      },
    },
  },
  extensions: { colorMeta: {} },
};

/** A valid config whose brand is the input; only the brand matters here. */
function parseBrand(brand: Record<string, unknown>): MarketingJson["brand"] {
  const config = marketingSchema.parse({
    brand: { name: "Acme", locale: "en-US", timezone: "UTC", ...brand },
    app: { baseUrl: "http://localhost:3000", port: 3100, startCommand: ["serve"], device: { viewport: [390, 844], scale: 3 } },
    voice: { voiceId: "v", language: "en" },
    videos: [
      {
        id: "a",
        title: "A",
        path: "/",
        persona: { name: "A", age: 30, tagline: "" },
        beats: [
          { id: "hook", text: "One." },
          { id: "b", text: "Two." },
          { id: "c", text: "Three." },
        ],
        hook: { still: "s", shots: [{ mark: "m", scale: 1 }] },
        screenGuard: ["x"],
        endCard: { headline: "H", url: "example.com" },
        sceneModule: "scene.ts",
      },
    ],
  });
  return config.brand;
}

const CAPTIONS = { captionBackground: "#ecf1f7f7", captionHighlight: "#059669" };

describe("resolveBrandColors", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "marketing-brand-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("takes every role from brand.colors when the brand has no source", () => {
    const colors = {
      background: "#0C0C0D",
      foreground: "#f2f3f5",
      muted: "#a3a6ad",
      accent: "#cff26b",
      cta: "#2dd4bf",
      onCta: "#0c0c0d",
      captionText: "#0c0c0d",
      ...CAPTIONS,
    };
    expect(resolveBrandColors(parseBrand({ colors }), dir)).toEqual({ ok: true, colors: { ...colors, background: "#0c0c0d" } });
  });

  it("names every role left without a colour", () => {
    const result = resolveBrandColors(parseBrand({ colors: { background: "#000000" } }), dir);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.map((issue) => issue.path.join("."))).toEqual([
      "brand.colors.foreground",
      "brand.colors.muted",
      "brand.colors.accent",
      "brand.colors.cta",
      "brand.colors.onCta",
      "brand.colors.captionBackground",
      "brand.colors.captionText",
      "brand.colors.captionHighlight",
    ]);
  });

  it("reads FIRE_TRACKER's stylesheet with its role names mapped, inline colours winning", () => {
    writeFileSync(join(dir, "globals.css"), readFileSync(new URL("fixtures/globals.css", import.meta.url), "utf8"));
    const brand = parseBrand({
      tokensFrom: { css: "globals.css", roles: { cta: "accessible", onCta: "background", captionText: "background" } },
      colors: { ...CAPTIONS, muted: "#999999" },
    });
    // Oracle: the dark theme of tests/fixtures/globals.css, read by hand.
    expect(resolveBrandColors(brand, dir)).toEqual({
      ok: true,
      colors: {
        background: "#0c0c0d",
        foreground: "#f2f3f5",
        muted: "#999999",
        accent: "#cff26b",
        cta: "#2dd4bf",
        onCta: "#0c0c0d",
        captionBackground: "#ecf1f7f7",
        captionText: "#0c0c0d",
        captionHighlight: "#059669",
      },
    });
  });

  it("reads a design.json theme, a role reading the token of its own kebab name by default", () => {
    writeFileSync(join(dir, "design.json"), JSON.stringify(FIRE_DESIGN));
    const brand = parseBrand({
      tokensFrom: { designJson: "design.json", theme: "dark", roles: { cta: "accessible", captionText: "background" } },
      colors: CAPTIONS,
    });
    const result = resolveBrandColors(brand, dir);
    // `onCta` reads `on-cta`, which FIRE's design.json does not have.
    expect(!result.ok && result.issues).toEqual([
      {
        path: ["brand", "colors", "onCta"],
        message: 'not set, and brand.tokensFrom has no colour for it: no role "on-cta" in themes.dark.roles. Set it here or map it with brand.tokensFrom.roles.onCta',
      },
    ]);
    const mapped = parseBrand({
      tokensFrom: { designJson: "design.json", roles: { cta: "accessible", onCta: "on-accent", captionText: "background" } },
      colors: CAPTIONS,
    });
    expect(resolveBrandColors(mapped, dir)).toMatchObject({ ok: true, colors: { cta: "#2dd4bf", onCta: "#0c0c0d", accent: "#cff26b" } });
  });

  it("names the source when it cannot be read", () => {
    const result = resolveBrandColors(parseBrand({ tokensFrom: { css: "missing.css" } }), dir);
    expect(!result.ok && result.issues).toEqual([{ path: ["brand", "tokensFrom", "css"], message: `cannot read ${join(dir, "missing.css")}: ENOENT` }]);
  });

  it("refuses a background with transparency, which the vignette cannot fade into", () => {
    const colors = { background: "#0c0c0dcc", foreground: "#fff", muted: "#999", accent: "#cff26b", cta: "#2dd4bf", onCta: "#000", captionText: "#000", ...CAPTIONS };
    const result = resolveBrandColors(parseBrand({ colors }), dir);
    expect(!result.ok && result.issues).toEqual([{ path: ["brand", "colors", "background"], message: '"#0c0c0dcc" must be #rrggbb: the vignette adds its own transparency' }]);
  });
});

describe("marketingSchema brand", () => {
  it.each([
    ["both sources", { tokensFrom: { css: "a.css", designJson: "d.json" } }, "needs exactly one of css and designJson"],
    ["no source", { tokensFrom: {} }, "needs exactly one of css and designJson"],
    ["a colour that is not hex", { colors: { accent: "red" } }, "must be a hex colour such as #0c0c0d"],
    ["an unknown role", { colors: { primary: "#ffffff" } }, "Unrecognized key"],
    ["a font family that could break the stylesheet", { fonts: { body: { family: 'A";}' } } }, "must be letters, digits, spaces, - and _"],
    ["a logo that is not SVG", { logo: { svg: "mark.png" } }, "must be an .svg file"],
  ])("refuses %s", (_case, brand, message) => {
    expect(() => parseBrand(brand)).toThrow(message);
  });
});

describe("readDesignJsonColors", () => {
  it("reads the named roles of one theme", () => {
    expect(readDesignJsonColors(FIRE_DESIGN, ["background", "accessible"], "light")).toEqual({ ok: true, colors: { background: "#f6f7f8", accessible: "#0f766e" } });
  });

  it.each([
    ["not an object", "design.json", "not a design.json: expected schemaVersion and themes"],
    ["another schema version", { schemaVersion: 1, themes: {} }, "schemaVersion 1 is not supported (expected 2)"],
    ["a theme without roles", { schemaVersion: 2, themes: { dark: {} } }, "no themes.dark.roles with string values"],
    ["a role that is not a colour literal", { schemaVersion: 2, themes: { dark: { roles: { background: "var(--ink)" } } } }, 'role "background" is "var(--ink)", and the film needs a colour literal (#rrggbb)'],
  ])("refuses %s", (_case, input, error) => {
    expect(readDesignJsonColors(input, ["background"], "dark")).toEqual({ ok: false, error });
  });
});
