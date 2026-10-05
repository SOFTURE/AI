// The OG card's colours: the brand's, else the dark scheme of the default theme; its fonts: the brand's.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DEFAULT_THEME } from "@softure-ai/ui";
import { getOgColors, getOgFontFamily, OG_IMAGE_SIZE, renderArticleOgImage, type OgFont } from "@softure-ai/blog/next";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

function readInter(weight: 400 | 700): ArrayBuffer {
  const file = readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

async function renderCard(fonts?: readonly OgFont[]): Promise<Uint8Array> {
  const card = renderArticleOgImage({ title: "Index funds", label: "Blog", brand: { name: "Example" }, ...(fonts === undefined ? {} : { fonts }) });
  return new Uint8Array(await card.arrayBuffer());
}

describe("OG image", () => {
  it("is 1200 by 630", () => {
    expect(OG_IMAGE_SIZE).toEqual({ width: 1200, height: 630 });
  });

  it("takes each colour from the brand, else from the default dark scheme", () => {
    expect(getOgColors(undefined)).toEqual({
      background: DEFAULT_THEME.dark["color-background"],
      foreground: DEFAULT_THEME.dark["color-foreground"],
      accent: DEFAULT_THEME.dark["color-accent-fill"],
    });
    const accent = "#123456";
    expect(getOgColors({ name: "Example", colors: { accent } })).toEqual({ ...getOgColors(undefined), accent });
  });

  it("writes in every font family it is given, each once and in order", () => {
    const data = new ArrayBuffer(0);
    expect(getOgFontFamily([])).toBeUndefined();
    expect(getOgFontFamily([{ name: "Inter", data, weight: 400 }, { name: "Inter", data, weight: 700 }, { name: "Inter Ext", data }])).toBe('"Inter", "Inter Ext"');
  });

  it("draws the card in the brand's fonts instead of the default font", async () => {
    const inter = [
      { name: "Inter", data: readInter(400), weight: 400 },
      { name: "Inter", data: readInter(700), weight: 700 },
    ] as const;
    const [withDefault, withInter] = await Promise.all([renderCard(), renderCard(inter)]);
    expect([...withInter.subarray(0, 4)]).toEqual(PNG_SIGNATURE);
    expect([...withDefault.subarray(0, 4)]).toEqual(PNG_SIGNATURE);
    expect(Buffer.from(withInter).equals(Buffer.from(withDefault))).toBe(false);
  });
});
