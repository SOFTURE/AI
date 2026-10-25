import { readFileSync } from "node:fs";

import { buildThemeCss, findMissingColorRoles, isColorAlias, type ColorValue } from "@softure-ai/theme-kit";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { FLAT_PAINT_THEME } from "../src/index.js";

const themed = z.object({ light: z.string(), dark: z.string() });
const tokenList = <T extends z.ZodTypeAny>(value: T) => z.object({ tokens: z.array(z.object({ name: z.string(), value })) });
const snapshotSchema = z.object({
  color: tokenList(z.union([themed, z.string()])),
  type: z.object({
    families: z.record(z.string(), z.string()),
    groups: z.array(
      z.object({
        styles: z.array(
          z.object({
            name: z.string(),
            family: z.string().optional(),
            fontSize: z.string(),
            lineHeight: z.union([z.string(), z.number()]),
            fontWeight: z.number(),
            letterSpacing: z.string().optional(),
          }),
        ),
      }),
    ),
  }),
  spacing: tokenList(z.string()),
  radius: tokenList(z.string()),
  size: tokenList(z.string()),
  container: tokenList(z.string()),
  shadow: tokenList(z.string()),
});

const snapshot = snapshotSchema.parse(
  JSON.parse(readFileSync(new URL("./fixtures/flat-paint-tokens.json", import.meta.url), "utf8")) as unknown,
);

const snapshotColors = new Map(snapshot.color.tokens.map((token) => [token.name, token.value]));

/** A design system value: a colour, or `{name}`, a reference to another token, followed to its colour. */
function resolve(value: string): string {
  const reference = /^\{(.+)\}$/.exec(value)?.[1];
  if (reference === undefined) return value;
  const target = snapshotColors.get(reference);
  if (typeof target !== "string") throw new Error(`"${value}" does not name a single-value token`);
  return resolve(target);
}

/** How the definition writes a snapshot colour: a whole-token reference stays an alias, everything else a value. */
function toColorValue(value: z.infer<typeof themed> | string): ColorValue {
  if (typeof value === "string") {
    const reference = /^\{(.+)\}$/.exec(value)?.[1];
    return reference === undefined ? { light: value, dark: value } : { alias: reference };
  }
  return { light: resolve(value.light), dark: resolve(value.dark) };
}

const ownColors = Object.entries(FLAT_PAINT_THEME.colors).slice(0, snapshot.color.tokens.length);
const shadcnAliases = Object.entries(FLAT_PAINT_THEME.colors).slice(snapshot.color.tokens.length);

describe("FLAT_PAINT_THEME", () => {
  it("starts with exactly the snapshot's colours, in its order, with their light and dark values", () => {
    expect(ownColors).toEqual(snapshot.color.tokens.map((token) => [token.name, toColorValue(token.value)]));
  });

  it("adds only aliases of its own colours for the shadcn roles", () => {
    for (const [name, value] of shadcnAliases) {
      expect([name, isColorAlias(value) && snapshotColors.has(value.alias)]).toEqual([name, true]);
    }
  });

  it("has the snapshot's shadows, font families, text styles, radii and sizes", () => {
    expect(FLAT_PAINT_THEME.shadows).toEqual(
      Object.fromEntries(
        snapshot.shadow.tokens.map((token) => [token.name.replace(/^shadow-/, ""), { light: token.value, dark: token.value }]),
      ),
    );
    expect(FLAT_PAINT_THEME.fonts).toEqual(snapshot.type.families);
    expect(FLAT_PAINT_THEME.textStyles).toEqual(
      Object.fromEntries(
        snapshot.type.groups
          .flatMap((group) => group.styles)
          .map(({ name, fontSize, lineHeight, fontWeight, letterSpacing }) => [
            name,
            // The family stays out: the definition's text styles take no font (a `tabular` figure sets it by class).
            { fontSize, lineHeight: String(lineHeight), fontWeight, ...(letterSpacing === undefined ? {} : { letterSpacing }) },
          ]),
      ),
    );
    expect(FLAT_PAINT_THEME.radii).toEqual(
      Object.fromEntries(snapshot.radius.tokens.map((token) => [token.name.replace(/^radius-/, ""), token.value])),
    );
    expect(FLAT_PAINT_THEME.sizes).toEqual(
      Object.fromEntries(
        [...snapshot.spacing.tokens, ...snapshot.size.tokens, ...snapshot.container.tokens].map((token) => [
          token.name.replace(/^(spacing|size|container)-/, ""),
          token.value,
        ]),
      ),
    );
  });

  it("defines every colour role shadcn/ui components read", () => {
    expect(findMissingColorRoles(FLAT_PAINT_THEME)).toEqual([]);
  });

  it("generates its CSS without an error, clearing Tailwind's default palette", () => {
    const css = buildThemeCss(FLAT_PAINT_THEME);
    expect(css).toContain("  --accent-fill: #cff26b;");
    expect(css).toContain("  --primary: var(--accent-fill);");
    expect(css).toContain("  --color-*: initial;");
  });
});
