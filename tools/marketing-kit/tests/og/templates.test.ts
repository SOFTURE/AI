import { describe, expect, it } from "vitest";

import { listNodes } from "../../src/og/element.js";
import { loadOgFonts, type OgFonts } from "../../src/og/fonts.js";
import { buildOgTree, countOgSlides, type OgImageInput } from "../../src/og/render.js";
import { OG_TEMPLATE_IDS } from "../../src/og/templates/index.js";
import { bigNumberDataSchema, carouselDataSchema, headlineChartDataSchema, headlineCtaDataSchema } from "../../src/og/templates/schemas.js";
import { COLORS, LOGO_SVG, SAMPLE_DATA, getInterFile, loadInter, makeFont } from "./helpers.js";

function input(template: string, fonts: OgFonts = loadInter(), data: unknown = SAMPLE_DATA[template]): OgImageInput {
  return { template, data, brand: { name: "Fixture Plan", colors: COLORS, logoSvg: LOGO_SVG }, fonts };
}

function getFontWeights(template: string, fonts: OgFonts): number[] {
  const tree = buildOgTree(input(template, fonts));
  if (!tree.ok) throw new Error(tree.error);
  return [...new Set(listNodes(tree.value).flatMap((node) => (node.props.style?.fontWeight === undefined ? [] : [Number(node.props.style.fontWeight)])))].sort();
}

describe("OG templates", () => {
  it("has sample data for every template", () => {
    expect(Object.keys(SAMPLE_DATA).sort()).toEqual([...OG_TEMPLATE_IDS].sort());
  });

  it.each(OG_TEMPLATE_IDS)("%s uses only font weights that are loaded", (template) => {
    expect(getFontWeights(template, loadInter())).toEqual([400, 700]);
    const regularOnly = loadOgFonts({ heading: makeFont([{ path: getInterFile(400), weight: "400" }]), body: null });
    if (!regularOnly.ok) throw new Error(regularOnly.error);
    expect(getFontWeights(template, regularOnly.value)).toEqual([400]);
  });

  it.each(OG_TEMPLATE_IDS)("%s paints only with the brand's palette", (template) => {
    const tree = buildOgTree(input(template));
    if (!tree.ok) throw new Error(tree.error);
    const colours = listNodes(tree.value).flatMap((node) =>
      [node.props.style?.color, node.props.style?.backgroundColor, node.props.stroke, node.props.fill].filter((value) => typeof value === "string" && value.startsWith("#")),
    );
    const allowed = [COLORS.background, COLORS.foreground, COLORS.muted, COLORS.accent, COLORS.cta, COLORS.onCta, "#f2f3f514", "#cff26b33"];
    expect(colours.filter((colour) => !allowed.includes(String(colour)))).toEqual([]);
  });

  it("draws the brand's name and logo", () => {
    const tree = buildOgTree(input("headline-cta"));
    if (!tree.ok) throw new Error(tree.error);
    const nodes = listNodes(tree.value);
    expect(nodes.some((node) => node.props.children === "Fixture Plan")).toBe(true);
    expect(nodes.find((node) => node.type === "img")?.props.src).toBe(`data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`);
  });

  it("scales sizes with the card's width", () => {
    const at = (size: [number, number]) => {
      const tree = buildOgTree({ ...input("headline-cta"), size });
      if (!tree.ok) throw new Error(tree.error);
      return listNodes(tree.value).find((node) => node.props.children === "Stop working at 49")?.props.style?.fontSize;
    };
    expect([at([1200, 630]), at([600, 315])]).toEqual([72, 36]);
  });

  it("refuses an unknown template, naming the known ones", () => {
    expect(buildOgTree(input("poster", loadInter(), {}))).toEqual({ ok: false, error: 'OG image: unknown template "poster"; known: headline-cta, headline-chart, big-number, carousel.' });
  });

  it("refuses invalid data with the path of each problem", () => {
    const result = buildOgTree(input("headline-cta", loadInter(), { headline: "", tiles: [{ label: "x", value: "12345678901234567" }], extra: 1 }));
    expect(result.ok ? null : result.error.split("\n")).toEqual([
      'OG image: the data of template "headline-cta" is not valid:',
      "  data.headline: must not be blank",
      "  data.tiles[0].value: must be at most 16 characters",
      '  data: Unrecognized key: "extra"',
    ]);
  });
});

describe("portrait templates", () => {
  function getFontSize(template: string, size: [number, number], content: string, data?: unknown): unknown {
    const tree = buildOgTree({ ...input(template, loadInter(), data), size });
    if (!tree.ok) throw new Error(tree.error);
    return listNodes(tree.value).find((node) => node.props.children === content)?.props.style?.fontSize;
  }

  it("scales by the limiting side of the 1080×1350 post, not by width alone", () => {
    expect([[1080, 1350], [1080, 1080], [1080, 1920], [540, 675]].map((size) => getFontSize("big-number", size as [number, number], "898 PLN"))).toEqual([180, 144, 180, 90]);
  });

  it("gives a shorter number bigger type", () => {
    const sizeOf = (number: string) => getFontSize("big-number", [1080, 1350], number, { number, caption: "x" });
    expect(["898", "28 260", "898 PLN", "1 356 PLN", "1 356,48 PLN"].map(sizeOf)).toEqual([300, 220, 180, 150, 124]);
  });

  it("draws the counter of every slide, or none when it is off", () => {
    const counterOf = (slide: number, counter?: boolean) => {
      const data = { ...(SAMPLE_DATA.carousel as object), ...(counter === undefined ? {} : { counter }) };
      const tree = buildOgTree({ ...input("carousel", loadInter(), data), slide });
      if (!tree.ok) throw new Error(tree.error);
      return listNodes(tree.value).find((node) => typeof node.props.children === "string" && /^\d+\/\d+$/.test(node.props.children))?.props.children ?? null;
    };
    expect([counterOf(1), counterOf(2), counterOf(3), counterOf(2, false)]).toEqual(["1/3", "2/3", "3/3", null]);
  });

  it("draws the slide asked for", () => {
    const tree = buildOgTree({ ...input("carousel"), slide: 2 });
    if (!tree.ok) throw new Error(tree.error);
    const texts = listNodes(tree.value).map((node) => node.props.children).filter((child) => typeof child === "string");
    expect(texts).toEqual(["Fixture Plan", "2/3", "Myth.", "The yearly limit is a cap, not an entry fee.", "Source: the act, 2026"]);
  });

  it("refuses a slide the data does not have", () => {
    expect([0, 4, 1.5].map((slide) => buildOgTree({ ...input("carousel"), slide })).map((result) => (result.ok ? "ok" : result.error))).toEqual([
      'OG image: template "carousel" has 3 slides; there is no slide 0.',
      'OG image: template "carousel" has 3 slides; there is no slide 4.',
      'OG image: template "carousel" has 3 slides; there is no slide 1.5.',
    ]);
    expect(buildOgTree({ ...input("big-number"), slide: 2 })).toEqual({ ok: false, error: 'OG image: template "big-number" has 1 slide; there is no slide 2.' });
  });

  it("counts the images a template's data makes", () => {
    expect([countOgSlides("carousel", SAMPLE_DATA.carousel), countOgSlides("big-number", SAMPLE_DATA["big-number"]), countOgSlides("headline-cta", SAMPLE_DATA["headline-cta"])]).toEqual([
      { ok: true, value: 3 },
      { ok: true, value: 1 },
      { ok: true, value: 1 },
    ]);
    expect(countOgSlides("carousel", { slides: [] })).toEqual({ ok: false, error: 'OG image: the data of template "carousel" is not valid.' });
    expect(countOgSlides("poster", {})).toEqual({ ok: false, error: 'OG image: unknown template "poster"; known: headline-cta, headline-chart, big-number, carousel.' });
  });
});

describe("template data schemas", () => {
  it("caps the portrait copy at what the post has room for", () => {
    const tile = { label: "a", value: "1" };
    const number = bigNumberDataSchema.safeParse({ number: "1".repeat(13), caption: "c".repeat(91), tiles: [tile, tile, tile], source: "s".repeat(81), cta: "c".repeat(33) });
    expect(number.success ? [] : number.error.issues.map((issue) => issue.path.join("."))).toEqual(["number", "caption", "tiles", "cta", "source"]);
    const slide = { headline: "h".repeat(91), body: "b".repeat(201), tiles: [tile, tile, tile] };
    const carousel = carouselDataSchema.safeParse({ slides: [slide, { headline: "x" }] });
    expect(carousel.success ? [] : carousel.error.issues.map((issue) => issue.path.join("."))).toEqual(["slides.0.headline", "slides.0.body", "slides.0.tiles"]);
  });

  it("takes two to ten slides", () => {
    const slides = (count: number) => carouselDataSchema.safeParse({ slides: Array.from({ length: count }, () => ({ headline: "x" })) }).success;
    expect([1, 2, 10, 11].map(slides)).toEqual([false, true, true, false]);
  });

  it("caps the copy at what a card has room for", () => {
    const issues = headlineCtaDataSchema.safeParse({ eyebrow: "e".repeat(41), headline: "h".repeat(91), cta: "c".repeat(33), tiles: Array(5).fill({ label: "a", value: "1" }) });
    expect(issues.success ? [] : issues.error.issues.map((issue) => issue.path.join("."))).toEqual(["eyebrow", "headline", "cta", "tiles"]);
  });

  it("accepts a headline alone", () => {
    expect(headlineCtaDataSchema.parse({ headline: "Count" })).toEqual({ headline: "Count", tiles: [] });
  });

  it("takes chart paths as path data only, so no markup reaches the image", () => {
    const chart = (d: string) => headlineChartDataSchema.safeParse({ headline: "x", chart: { viewBox: [10, 10], paths: [{ d }] } }).success;
    expect(chart("M0 0 L10 10 C 1.5,2e-1 3 4 5 6 Z")).toBe(true);
    expect(chart('M0 0"/><script>alert(1)</script>')).toBe(false);
    expect(chart("M0 0 url(#x)")).toBe(false);
  });

  it("defaults a chart path to an accent line", () => {
    const parsed = headlineChartDataSchema.parse({ headline: "x", chart: { viewBox: [10, 10], paths: [{ d: "M0 0 L1 1" }] } });
    expect(parsed.chart.paths).toEqual([{ d: "M0 0 L1 1", tone: "accent", fill: false }]);
  });
});
