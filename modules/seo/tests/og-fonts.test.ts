// The OG card font loader for an app's own `opengraph-image` routes, re-exported from core so an app without the blog has it.
import { createOgFontLoader as createCoreOgFontLoader, loadOgFonts as loadCoreOgFonts, OG_FONT_WEIGHTS as CORE_OG_FONT_WEIGHTS } from "@softure-ai/core/og";
import { createOgFontLoader, loadOgFonts, OG_FONT_WEIGHTS } from "@softure-ai/seo/server";
import { describe, expect, it } from "vitest";

describe("OG font loader in @softure-ai/seo/server", () => {
  it("is core's loader, not a copy", () => {
    expect(createOgFontLoader).toBe(createCoreOgFontLoader);
    expect(loadOgFonts).toBe(loadCoreOgFonts);
    expect(OG_FONT_WEIGHTS).toBe(CORE_OG_FONT_WEIGHTS);
  });

  it("reads a font with seo's default label in its messages", async () => {
    const load = createOgFontLoader({ root: "/app", readFile: () => Promise.resolve(new Uint8Array([0x77, 0x4f, 0x46, 0x46, 0, 0])) });
    const result = await load([{ name: "Inter", src: "fonts/inter.woff", weight: 700 }]);
    expect(result.ok && result.fonts.map(({ name, weight }) => ({ name, weight }))).toEqual([{ name: "Inter", weight: 700 }]);
    const missing = createOgFontLoader({ root: "/app", readFile: () => Promise.reject(Object.assign(new Error("missing"), { code: "ENOENT" })) });
    expect(await missing([{ name: "Inter", src: "fonts/inter.woff" }])).toEqual({
      ok: false,
      error: 'OG card: fonts[0] "fonts/inter.woff": the file cannot be read (ENOENT) (/app/fonts/inter.woff).',
    });
  });
});
