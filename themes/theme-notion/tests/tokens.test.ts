import { readFileSync } from "node:fs";

import { buildThemeCss, findMissingColorRoles, type ColorValue } from "@softure-ai/theme-kit";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { NOTION_THEME } from "../src/index.js";

const themed = z.object({ light: z.string(), dark: z.string() });
const snapshotSchema = z.object({
  color: z.object({ tokens: z.array(z.object({ name: z.string(), value: z.union([themed, z.string()]) })) }),
  type: z.object({
    families: z.record(z.string(), z.string()),
    groups: z.array(
      z.object({
        styles: z.array(
          z.object({
            name: z.string(),
            fontSize: z.string(),
            lineHeight: z.string(),
            fontWeight: z.number(),
            letterSpacing: z.string().optional(),
          }),
        ),
      }),
    ),
  }),
  spacing: z.object({ tokens: z.array(z.object({ name: z.string(), value: z.string() })) }),
  radius: z.object({ tokens: z.array(z.object({ name: z.string(), value: z.string() })) }),
  shadow: z.object({ tokens: z.array(z.object({ name: z.string(), value: themed })) }),
  size: z.object({ tokens: z.array(z.object({ name: z.string(), value: z.string() })) }),
});

const snapshot = snapshotSchema.parse(
  JSON.parse(readFileSync(new URL("./fixtures/notion-tokens.json", import.meta.url), "utf8")) as unknown,
);

function toColorValue(value: z.infer<typeof themed> | string): ColorValue {
  return typeof value === "string" ? { alias: value.replace(/[{}]/g, "") } : value;
}

describe("NOTION_THEME", () => {
  it("has exactly the snapshot's colours, in its order, with their light and dark values or aliases", () => {
    expect(Object.entries(NOTION_THEME.colors)).toEqual(snapshot.color.tokens.map((token) => [token.name, toColorValue(token.value)]));
  });

  it("has the snapshot's shadows, font families, text styles, radii and layout sizes", () => {
    expect(NOTION_THEME.shadows).toEqual(
      Object.fromEntries(snapshot.shadow.tokens.map((token) => [token.name.replace(/^shadow-/, ""), token.value])),
    );
    expect(NOTION_THEME.fonts).toEqual(snapshot.type.families);
    expect(NOTION_THEME.textStyles).toEqual(
      Object.fromEntries(snapshot.type.groups.flatMap((group) => group.styles).map(({ name, ...style }) => [name, style])),
    );
    expect(NOTION_THEME.radii).toEqual(
      Object.fromEntries(snapshot.radius.tokens.map((token) => [token.name.replace(/^radius-/, ""), token.value])),
    );
    expect(NOTION_THEME.sizes).toEqual(Object.fromEntries(snapshot.size.tokens.map((token) => [token.name, token.value])));
  });

  it("defines every colour role shadcn/ui components read", () => {
    expect(findMissingColorRoles(NOTION_THEME)).toEqual([]);
  });

  it("keeps the spacing scale on Tailwind's 4 px multiplier, so `p-N` is the design system's `space-N`", () => {
    for (const token of snapshot.spacing.tokens) {
      const step = Number(token.name.replace("space-", ""));
      expect([token.name, token.value]).toEqual([token.name, `${step * 4}px`]);
    }
  });

  it("generates its CSS without an error, clearing Tailwind's default palette", () => {
    const css = buildThemeCss(NOTION_THEME);
    expect(css).toContain("  --primary: #0171cf;");
    expect(css).toContain("  --color-*: initial;");
  });
});
