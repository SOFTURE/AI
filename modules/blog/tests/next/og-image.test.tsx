// The OG card's colours: the brand's, else the dark scheme of the default theme.
import { DEFAULT_THEME } from "@softure-ai/ui";
import { getOgColors, OG_IMAGE_SIZE } from "@softure-ai/blog/next";
import { describe, expect, it } from "vitest";

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
});
