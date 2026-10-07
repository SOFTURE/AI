import { pickWeight, toFontFamilyCss, type OgFontFamily, type OgFontWeight } from "../fonts.js";
import { h, type OgChild, type OgNode, type OgStyle } from "../element.js";
import type { OgTemplateContext } from "./context.js";

/** Text in a family (and its subset families) at a size written for the layout's base card, in the loaded weight nearest `wish`. */
export function text(context: OgTemplateContext, family: OgFontFamily, size: number, wish: OgFontWeight): OgStyle {
  return { fontFamily: toFontFamilyCss(family), fontSize: Math.round(size * context.scale), fontWeight: pickWeight(family.weights, wish) };
}

/** A length written for the layout's base card. */
export function px(context: OgTemplateContext, value: number): number {
  return Math.round(value * context.scale);
}

/** The headline size: shorter headlines get bigger type. */
export function headlineSize(headline: string): number {
  if (headline.length <= 40) return 72;
  if (headline.length <= 64) return 60;
  return 52;
}

/**
 * The card every template shares: the brand's background, the logo and name at the top, and the
 * template's content filling the rest.
 */
export function frame(context: OgTemplateContext, content: (OgChild | null)[]): OgNode {
  const { palette } = context;
  const logoSize = px(context, 48);
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: px(context, 64),
        backgroundColor: palette.background,
        color: palette.foreground,
      },
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: px(context, 16) } },
      context.brand.logo === null ? null : h("img", { src: context.brand.logo, width: logoSize, height: logoSize, style: { width: logoSize, height: logoSize } }),
      h("div", { style: { ...text(context, context.fonts.body, 28, 600), color: palette.muted } }, context.brand.name),
    ),
    h("div", { style: { display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", marginTop: px(context, 24) } }, ...content),
  );
}

export interface Tile {
  label: string;
  value: string;
}

/** Figures in boxes: the value large, the label under it. */
export function tiles(context: OgTemplateContext, entries: readonly Tile[], direction: "row" | "column"): OgNode | null {
  if (entries.length === 0) return null;
  const { palette } = context;
  return h(
    "div",
    { style: { display: "flex", flexDirection: direction, gap: px(context, 20), marginTop: px(context, 36) } },
    ...entries.map((tile) =>
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            padding: `${px(context, 18)}px ${px(context, 24)}px`,
            borderRadius: px(context, 20),
            border: `${px(context, 2)}px solid ${palette.border}`,
            backgroundColor: palette.surface,
          },
        },
        h("div", { style: { ...text(context, context.fonts.heading, 44, 700), color: palette.foreground } }, tile.value),
        h("div", { style: { ...text(context, context.fonts.body, 22, 400), color: palette.muted, marginTop: px(context, 4) } }, tile.label),
      ),
    ),
  );
}

export function eyebrow(context: OgTemplateContext, value: string | undefined): OgNode | null {
  if (value === undefined) return null;
  return h("div", { style: { ...text(context, context.fonts.body, 26, 600), color: context.palette.accent, marginBottom: px(context, 16) } }, value);
}

export function headline(context: OgTemplateContext, value: string): OgNode {
  return h("div", { style: { ...text(context, context.fonts.heading, headlineSize(value), 700), lineHeight: 1.1, color: context.palette.foreground } }, value);
}
