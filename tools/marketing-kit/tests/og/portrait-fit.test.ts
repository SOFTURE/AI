import { Resvg } from "@resvg/resvg-js";
import { describe, expect, it } from "vitest";

import { renderOgSvg } from "../../src/og/render.js";
import { getLayoutScale } from "../../src/og/templates/context.js";
import { COLORS, LOGO_SVG, loadInter } from "./helpers.js";

/*
 * An oracle of another kind than the layout code: copy at every schema limit is rendered to pixels, and the frame's
 * outer padding must stay the bare background. A limit the template cannot hold spills text or a tile into the band.
 */

const PADDING = 80;
const SIZES: Record<string, [number, number]> = { portrait: [1080, 1350], square: [1080, 1080], story: [1080, 1920] };

/** Ordinary copy (words of mixed width, figures in digits) cut to `length` characters. */
function fill(length: number, words = "Limit 2026 to 28 260 PLN, a cap and not a must for anyone saving"): string {
  let copy = "";
  while (copy.length < length) copy += `${words} `;
  return copy.slice(0, length).trimEnd().padEnd(length, "m");
}

/** Capitals with no space: Satori breaks them inside the word instead of running past the frame. */
const wide = (length: number) => "W".repeat(length);

const tile = (wrap: (length: number) => string) => ({ label: wrap(24), value: wrap(16) });

const BIG_NUMBER_AT_LIMITS = {
  eyebrow: fill(40, "ONE NUMBER"),
  number: "1 356 480,48",
  caption: fill(90),
  tiles: [tile(fill), tile(fill)],
  cta: fill(32, "Count your plan"),
  source: fill(80, "Source: ZUS life expectancy tables"),
};

const SLIDE_AT_LIMITS = {
  eyebrow: fill(40, "MYTH OR FACT"),
  headline: fill(90),
  body: fill(200),
  tiles: [tile(fill), tile(fill)],
  cta: fill(32, "Count your plan"),
  source: fill(80, "Source: the act on IKE"),
};

const WIDE_SLIDE = { eyebrow: wide(40), headline: wide(30), tiles: [tile(wide), tile(wide)], cta: wide(32), source: wide(80) };

/** The rows and columns of the outer padding band that hold anything but the background colour. */
async function findPaintInPadding(template: string, data: unknown, size: [number, number], slide = 1, padding = PADDING): Promise<string[]> {
  const svg = await renderOgSvg({ template, data, size, slide, brand: { name: "Fixture Plan", colors: COLORS, logoSvg: LOGO_SVG }, fonts: loadInter() });
  if (!svg.ok) throw new Error(svg.error);
  const [width, height] = size;
  const image = new Resvg(svg.value, { fitTo: { mode: "original" }, font: { loadSystemFonts: false } }).render();
  const pixels = image.pixels;
  // Anti-aliasing may reach one pixel past a box; the band starts two pixels outside the content.
  const band = Math.round(padding * getLayoutScale("portrait", width, height)) - 2;
  const background = [0x0c, 0x0c, 0x0d];
  const painted = new Set<string>();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isBand = x < band || x >= width - band || y < band || y >= height - band;
      if (!isBand) continue;
      const offset = (y * width + x) * 4;
      if (pixels[offset] !== background[0] || pixels[offset + 1] !== background[1] || pixels[offset + 2] !== background[2]) {
        painted.add(x < band ? "left" : x >= width - band ? "right" : y < band ? "top" : "bottom");
      }
    }
  }
  return [...painted].sort();
}

describe("portrait templates at the schema's limits", () => {
  it.each(Object.keys(SIZES))("big-number keeps every field inside the %s frame", async (name) => {
    expect(await findPaintInPadding("big-number", BIG_NUMBER_AT_LIMITS, SIZES[name] as [number, number])).toEqual([]);
  });

  it.each(Object.keys(SIZES))("a carousel slide keeps every field inside the %s frame", async (name) => {
    expect(await findPaintInPadding("carousel", { slides: [SLIDE_AT_LIMITS, { headline: "Next" }] }, SIZES[name] as [number, number])).toEqual([]);
  });

  it.each(["8888", "888 888", "8888 888", "88 888 888", "888 888 8888"])("keeps the number %s inside the frame at its size step", async (number) => {
    expect(await findPaintInPadding("big-number", { number, caption: "x" }, [1080, 1350])).toEqual([]);
  });

  it("wraps a run of capitals with no space instead of running off the image", async () => {
    // Satori's break inside a word can leave a glyph's overhang a few pixels into the padding; the outer half stays clear.
    expect(await findPaintInPadding("carousel", { slides: [WIDE_SLIDE, { headline: "Next" }] }, [1080, 1350], 1, PADDING / 2)).toEqual([]);
    expect(await findPaintInPadding("big-number", { number: wide(12), caption: wide(40) }, [1080, 1350], 1, PADDING / 2)).toEqual([]);
  });

  it("reports paint where the band meets content (the oracle sees what it is meant to)", async () => {
    // A band twice as deep as the padding covers the logo and the copy: every side must be reported.
    expect(await findPaintInPadding("carousel", { slides: [SLIDE_AT_LIMITS, { headline: "Next" }] }, [1080, 1350], 1, 2 * PADDING)).toEqual(["bottom", "left", "right", "top"]);
  });
});
