import { Wallet } from "lucide";
import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";

import {
  APP_ICON_SIZE,
  APPLE_ICON_SIZE,
  buildAppIconElement,
  drawAppIcon,
  MANIFEST_ICON_SIZE,
  MANIFEST_LARGE_ICON_SIZE,
  MASKABLE_SAFE_ZONE,
  renderIconSvg,
  type IconNode,
} from "../src/next/index.js";
import { createCompleteTheme } from "./support/complete-theme.js";

const VALUE_THEME = (() => {
  const theme = createCompleteTheme({ name: "Values" });
  return {
    ...theme,
    colors: {
      ...theme.colors,
      background: { light: "#fefefe", dark: "#191919" },
      foreground: { light: "#37352f", dark: "#e3e3e1" },
      primary: { light: "#0171cf", dark: "#2383e2" },
      "primary-foreground": { light: "#ffffff", dark: "#f0f0f0" },
      secondary: { light: "#f1f1ef", dark: "#2f2f2f" },
      "secondary-foreground": { light: "#32302c", dark: "#d4d4d4" },
      accent: { light: "#e9e9e7", dark: "#373737" },
      "accent-foreground": { light: "#2c2c2b", dark: "#e5e5e5" },
    },
  };
})();

const ALIAS_THEME = (() => {
  const theme = createCompleteTheme({ name: "Aliases" });
  return {
    ...theme,
    colors: {
      ...theme.colors,
      "accent-fill": { light: "#e16259", dark: "#df5452" },
      "on-accent": { light: "#fffaf5", dark: "#1f1a17" },
      primary: { alias: "accent-fill" },
      "primary-foreground": { alias: "on-accent" },
    },
  };
})();

interface BoxStyle {
  background: string;
  borderRadius: number;
  width: string;
  height: string;
}

interface GlyphProps {
  src: string;
  width: number;
  height: number;
}

function readIcon(element: ReactElement): { box: BoxStyle; glyph: GlyphProps } {
  const box = element.props as { style: BoxStyle; children: unknown };
  if (!isValidElement(box.children)) throw new Error("readIcon: the box has no glyph element");
  return { box: box.style, glyph: box.children.props as GlyphProps };
}

function decodeSvg(src: string): string {
  const prefix = "data:image/svg+xml,";
  expect(src.startsWith(prefix)).toBe(true);
  return decodeURIComponent(src.slice(prefix.length));
}

describe("renderIconSvg", () => {
  it("draws a lucide icon's data with lucide's stroke defaults, coloured through the root", () => {
    expect(renderIconSvg(Wallet, "#ffffff")).toBe(
      '<svg color="#ffffff" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path>' +
        '<path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path></svg>',
    );
  });

  it("draws nested children, numbers, and leaves out React keys and undefined attributes", () => {
    const icon: IconNode = [["g", { opacity: 0.5, key: "g1", fill: undefined }, [["circle", { cx: 12, cy: 12, r: "10" }]]]];
    expect(renderIconSvg(icon, "#000000")).toContain('<g opacity="0.5"><circle cx="12" cy="12" r="10"></circle></g>');
  });

  it("escapes attribute values and the colour", () => {
    const svg = renderIconSvg([["path", { d: 'M0 0"/><script>' }]], '#000"');
    expect(svg).toContain('color="#000&quot;"');
    expect(svg).toContain('<path d="M0 0&quot;/&gt;&lt;script&gt;"></path>');
  });

  it("refuses a tag or an attribute name that is not an SVG name", () => {
    expect(() => renderIconSvg([["path onload=x", {}]], "#000000")).toThrow('renderIconSvg: tag name "path onload=x" is not an SVG name');
    expect(() => renderIconSvg([["path", { "d=x": "1" }]], "#000000")).toThrow('renderIconSvg: attribute name "d=x" is not an SVG name');
  });

  it("colours another icon set's standalone svg through the root, adding the namespace once", () => {
    expect(renderIconSvg({ svg: ' <svg viewBox="0 0 2 2"><circle cx="1" cy="1" r="1" fill="currentColor"/></svg>\n' }, "#123456")).toBe(
      '<svg color="#123456" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><circle cx="1" cy="1" r="1" fill="currentColor"/></svg>',
    );
    expect(renderIconSvg({ svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"></svg>' }, "#123456")).toBe(
      '<svg color="#123456" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"></svg>',
    );
  });

  it("draws icon data with the given stroke width", () => {
    expect(renderIconSvg(Wallet, "#ffffff", { strokeWidth: 2.25 })).toContain(' stroke-width="2.25" ');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("refuses the stroke width %s", (strokeWidth) => {
    expect(() => renderIconSvg(Wallet, "#ffffff", { strokeWidth })).toThrow(
      `renderIconSvg: strokeWidth must be a positive number, got ${strokeWidth}`,
    );
  });

  it("refuses a stroke width for svg markup, which draws its own stroke", () => {
    expect(() => renderIconSvg({ svg: '<svg viewBox="0 0 2 2"></svg>' }, "#000000", { strokeWidth: 3 })).toThrow(
      "renderIconSvg: strokeWidth applies only to icon data; the icon's svg markup draws its own stroke",
    );
  });

  it("refuses markup that is not one svg element", () => {
    expect(() => renderIconSvg({ svg: "<span>W</span>" }, "#000000")).toThrow(
      "renderIconSvg: the icon's svg must be one <svg> element, got <span>W</span>",
    );
  });
});

describe("buildAppIconElement", () => {
  it("draws the primary tone of the light scheme by default, rounded, the glyph at 62.5 % of the side", () => {
    const { box, glyph } = readIcon(buildAppIconElement({ theme: VALUE_THEME, icon: Wallet }));
    expect(box).toEqual({
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      background: "#0171cf",
      borderRadius: 7,
    });
    expect(glyph.width).toBe(20);
    expect(glyph.height).toBe(20);
    expect(decodeSvg(glyph.src).startsWith('<svg color="#ffffff" ')).toBe(true);
  });

  it.each([
    ["primary", "light", "#0171cf", "#ffffff"],
    ["primary", "dark", "#2383e2", "#f0f0f0"],
    ["secondary", "light", "#f1f1ef", "#32302c"],
    ["accent", "dark", "#373737", "#e5e5e5"],
    ["inverse", "light", "#37352f", "#fefefe"],
  ] as const)("draws the %s tone in the %s scheme from the contract roles", (tone, scheme, background, glyphColor) => {
    const { box, glyph } = readIcon(buildAppIconElement({ theme: VALUE_THEME, icon: Wallet, tone, scheme }));
    expect(box.background).toBe(background);
    expect(decodeSvg(glyph.src).startsWith(`<svg color="${glyphColor}" `)).toBe(true);
  });

  it("follows the theme's colour aliases", () => {
    const { box, glyph } = readIcon(buildAppIconElement({ theme: ALIAS_THEME, icon: Wallet }));
    expect(box.background).toBe("#e16259");
    expect(decodeSvg(glyph.src).startsWith('<svg color="#fffaf5" ')).toBe(true);
  });

  it("draws full bleed with the square shape, scaled to the size", () => {
    const { box, glyph } = readIcon(buildAppIconElement({ theme: VALUE_THEME, icon: Wallet, size: APPLE_ICON_SIZE, shape: "square" }));
    expect(box.borderRadius).toBe(0);
    expect(glyph.width).toBe(113);
    expect(glyph.height).toBe(113);
  });

  it("draws full bleed with the maskable shape, the glyph at half the side", () => {
    const { box, glyph } = readIcon(buildAppIconElement({ theme: VALUE_THEME, icon: Wallet, size: MANIFEST_LARGE_ICON_SIZE, shape: "maskable" }));
    expect(box.borderRadius).toBe(0);
    expect(glyph.width).toBe(256);
    expect(glyph.height).toBe(256);
  });

  it.each([
    ["rounded", 0.68, 22],
    ["square", 1, 32],
    ["maskable", MASKABLE_SAFE_ZONE / Math.SQRT2, 18],
  ] as const)("draws the %s shape at the given glyph scale %s", (shape, glyphScale, glyphSide) => {
    const { glyph } = readIcon(buildAppIconElement({ theme: VALUE_THEME, icon: Wallet, shape, glyphScale }));
    expect(glyph.width).toBe(glyphSide);
    expect(glyph.height).toBe(glyphSide);
  });

  it.each([
    ["rounded", 0, "at most 1"],
    ["square", 1.01, "at most 1"],
    ["rounded", Number.NaN, "at most 1"],
    ["maskable", 0.6, "at most 0.566 (inside the maskable safe zone)"],
  ] as const)("refuses the %s shape at the glyph scale %s", (shape, glyphScale, range) => {
    expect(() => buildAppIconElement({ theme: VALUE_THEME, icon: Wallet, shape, glyphScale })).toThrow(
      `buildAppIconElement: glyphScale must be above 0 and ${range} for the ${shape} shape, got ${glyphScale}`,
    );
  });

  it("passes the stroke width to the glyph", () => {
    const { glyph } = readIcon(buildAppIconElement({ theme: VALUE_THEME, icon: Wallet, strokeWidth: 2.5 }));
    expect(decodeSvg(glyph.src)).toContain(' stroke-width="2.5" ');
  });
});

function readPngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe("drawAppIcon", () => {
  it("returns a PNG image response of the requested size", async () => {
    const response = drawAppIcon({ theme: ALIAS_THEME, icon: Wallet });
    expect(response.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(readPngSize(bytes)).toEqual(APP_ICON_SIZE);
  });

  it("draws the apple icon size", async () => {
    const response = drawAppIcon({ theme: VALUE_THEME, icon: Wallet, size: APPLE_ICON_SIZE, shape: "square" });
    expect(readPngSize(new Uint8Array(await response.arrayBuffer()))).toEqual({ width: 180, height: 180 });
  });

  it.each([
    ["standard manifest", MANIFEST_ICON_SIZE, "square", { width: 192, height: 192 }],
    ["maskable manifest", MANIFEST_LARGE_ICON_SIZE, "maskable", { width: 512, height: 512 }],
  ] as const)("draws the %s icon size", async (_name, size, shape, expected) => {
    const response = drawAppIcon({ theme: VALUE_THEME, icon: Wallet, size, shape });
    expect(readPngSize(new Uint8Array(await response.arrayBuffer()))).toEqual(expected);
  });
});
