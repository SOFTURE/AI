import { describe, expect, it } from "vitest";

import { listNodes } from "../../src/og/element.js";
import { loadOgFonts, type OgFonts } from "../../src/og/fonts.js";
import { buildOgTree, type OgImageInput } from "../../src/og/render.js";
import { OG_TEMPLATE_IDS } from "../../src/og/templates/index.js";
import { headlineChartDataSchema, headlineCtaDataSchema } from "../../src/og/templates/schemas.js";
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
    expect(buildOgTree(input("poster", loadInter(), {}))).toEqual({ ok: false, error: 'OG image: unknown template "poster"; known: headline-cta, headline-chart.' });
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

describe("template data schemas", () => {
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
