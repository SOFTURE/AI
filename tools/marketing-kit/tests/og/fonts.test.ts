import { describe, expect, it } from "vitest";

import { loadOgFonts, pickWeight } from "../../src/og/fonts.js";
import { INTER, getInterFile, makeFont } from "./helpers.js";

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
    expect(fromHeading.ok && fromHeading.value.body).toEqual({ family: "Inter", weights: [400, 700] });
    expect(fromBody.ok && fromBody.value.heading).toEqual({ family: "Inter", weights: [400, 700] });
  });

  it("keeps the heading and body families apart", () => {
    const body = makeFont([{ path: getInterFile(400), weight: "400" }], "Body Face");
    const loaded = loadOgFonts({ heading: makeFont([{ path: getInterFile(700), weight: "700" }]), body });
    expect(loaded.ok && [loaded.value.heading, loaded.value.body]).toEqual([
      { family: "Inter", weights: [700] },
      { family: "Body Face", weights: [400] },
    ]);
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
