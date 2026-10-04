import { describe, expect, it } from "vitest";

import { loadOgFonts, pickWeight, toFontFamilyCss } from "../../src/og/fonts.js";
import { INTER, getInterExtFile, getInterFile, makeFont } from "./helpers.js";

describe("loadOgFonts", () => {
  it("loads static .woff files with their weights for Satori", () => {
    const loaded = loadOgFonts({ heading: INTER, body: null });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.satoriFonts.map(({ name, weight, style }) => ({ name, weight, style }))).toEqual([
      { name: "Inter", weight: 400, style: "normal" },
      { name: "Inter", weight: 700, style: "normal" },
    ]);
    expect(loaded.value.satoriFonts[0]?.data.subarray(0, 4).toString("latin1")).toBe("wOFF");
  });

  it("lets the body borrow the heading font and the other way round", () => {
    const fromHeading = loadOgFonts({ heading: INTER, body: null });
    const fromBody = loadOgFonts({ heading: null, body: INTER });
    expect(fromHeading.ok && fromHeading.value.body).toEqual({ family: "Inter", weights: [400, 700], subsetFamilies: [] });
    expect(fromBody.ok && fromBody.value.heading).toEqual({ family: "Inter", weights: [400, 700], subsetFamilies: [] });
  });

  it("keeps the heading and body families apart", () => {
    const body = makeFont([{ path: getInterFile(400), weight: "400" }], "Body Face");
    const loaded = loadOgFonts({ heading: makeFont([{ path: getInterFile(700), weight: "700" }]), body });
    expect(loaded.ok && [loaded.value.heading, loaded.value.body]).toEqual([
      { family: "Inter", weights: [700], subsetFamilies: [] },
      { family: "Body Face", weights: [400], subsetFamilies: [] },
    ]);
  });

  it("registers further files of a weight and style as subset families, in the order listed", () => {
    const font = makeFont([
      { path: getInterFile(400), weight: "400" },
      { path: getInterExtFile(400), weight: "400" },
      { path: getInterFile(700), weight: "700" },
      { path: getInterExtFile(700), weight: "700" },
      { path: getInterExtFile(400), weight: "400" },
    ]);
    const loaded = loadOgFonts({ heading: font, body: null });
    expect(loaded.ok && loaded.value.satoriFonts.map(({ name, weight }) => `${name} ${weight}`)).toEqual([
      "Inter 400",
      "Inter #2 400",
      "Inter 700",
      "Inter #2 700",
      "Inter #3 400",
    ]);
    expect(loaded.ok && loaded.value.heading).toEqual({ family: "Inter", weights: [400, 700], subsetFamilies: ["Inter #2", "Inter #3"] });
  });

  it("counts subset files per style, so an italic file does not take an upright position", () => {
    const font = makeFont([
      { path: getInterFile(400), weight: "400" },
      { path: getInterFile(400), weight: "400", style: "italic" },
      { path: getInterExtFile(400), weight: "400" },
    ]);
    const loaded = loadOgFonts({ heading: null, body: font });
    expect(loaded.ok && loaded.value.satoriFonts.map(({ name, style }) => `${name} ${style}`)).toEqual(["Inter normal", "Inter italic", "Inter #2 normal"]);
  });

  it("refuses a .woff2 file, naming its JSON path", () => {
    const font = makeFont([{ path: getInterFile(400, "woff2"), weight: "400" }]);
    expect(loadOgFonts({ heading: null, body: font })).toEqual({
      ok: false,
      error: "OG images: brand.fonts.body.files[0] is .woff2; Satori reads only .ttf, .otf and .woff files.",
    });
  });

  it("refuses a variable weight range", () => {
    const font = makeFont([{ path: getInterFile(400), weight: "100 900" }]);
    expect(loadOgFonts({ heading: font, body: null })).toEqual({
      ok: false,
      error: 'OG images: brand.fonts.heading.files[0] has weight "100 900"; Satori needs one static weight from 100 to 900 in steps of 100.',
    });
  });

  it("refuses a file without a readable character map, naming its JSON path", () => {
    const font = makeFont([{ path: "broken.woff", weight: "400" }]);
    expect(loadOgFonts({ heading: font, body: null }, () => Buffer.from("not a font"))).toEqual({
      ok: false,
      error: "OG images: brand.fonts.heading.files[0] (broken.woff) has no readable character map: the file is not a TrueType, OpenType or WOFF font.",
    });
  });

  it("refuses a weight between the hundreds", () => {
    const loaded = loadOgFonts({ heading: makeFont([{ path: getInterFile(400), weight: "450" }]), body: null });
    expect(loaded.ok).toBe(false);
  });

  it("refuses a brand without fonts", () => {
    expect(loadOgFonts({ heading: null, body: makeFont([]) })).toEqual({
      ok: false,
      error: "OG images need at least one .ttf, .otf or .woff file in brand.fonts.heading or brand.fonts.body.",
    });
  });

  it("refuses a family with italic files only", () => {
    const font = makeFont([{ path: getInterFile(400), weight: "400", style: "italic" }]);
    expect(loadOgFonts({ heading: font, body: null })).toEqual({
      ok: false,
      error: 'OG images: brand.fonts.heading has no upright (style "normal") file; add one.',
    });
  });

  it("names the file it cannot read", () => {
    const font = makeFont([{ path: "/nowhere/face.ttf", weight: "400" }]);
    expect(loadOgFonts({ heading: font, body: null })).toEqual({
      ok: false,
      error: "OG images: reading the font /nowhere/face.ttf (brand.fonts.heading.files[0]): ENOENT.",
    });
  });
});

describe("pickWeight", () => {
  it("returns the wish when it is loaded", () => {
    expect(pickWeight([400, 700], 700)).toBe(700);
  });

  it("returns the nearest loaded weight", () => {
    expect(pickWeight([400, 700], 600)).toBe(700);
    expect(pickWeight([400, 700], 500)).toBe(400);
    expect(pickWeight([400], 900)).toBe(400);
  });

  it("breaks a tie towards the heavier weight", () => {
    expect(pickWeight([400, 600], 500)).toBe(600);
  });
});

describe("toFontFamilyCss", () => {
  it("names the family alone without subset files, and its subset families after it", () => {
    expect(toFontFamilyCss({ family: "Inter", weights: [400], subsetFamilies: [] })).toBe("Inter");
    expect(toFontFamilyCss({ family: "Inter", weights: [400], subsetFamilies: ["Inter #2", "Inter #3"] })).toBe("Inter, Inter #2, Inter #3");
  });
});
