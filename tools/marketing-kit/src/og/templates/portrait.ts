import { h, type OgChild, type OgNode } from "../element.js";
import type { OgTemplateContext } from "./context.js";
import { px, text, type Tile } from "./frame.js";

/** Sizes in this file are written for the 1080×1350 post (`PORTRAIT_BASE`). */

const PADDING = 80;

export interface PortraitFrame {
  /** "2/6" in the top corner, or null. */
  counter: string | null;
  content: (OgChild | null)[];
  cta: string | undefined;
  source: string | undefined;
}

/**
 * The portrait post: the logo and name on top (the counter opposite), the content filling the middle, and the call
 * to action and source line pinned to the bottom, so a tall frame spreads the post instead of adding empty bands.
 */
export function portraitFrame(context: OgTemplateContext, frame: PortraitFrame): OgNode {
  const { palette } = context;
  const logoSize = px(context, 64);
  const hasFooter = frame.cta !== undefined || frame.source !== undefined;
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: px(context, PADDING),
        backgroundColor: palette.background,
        color: palette.foreground,
      },
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: px(context, 20) } },
        context.brand.logo === null ? null : h("img", { src: context.brand.logo, width: logoSize, height: logoSize, style: { width: logoSize, height: logoSize } }),
        h("div", { style: { ...text(context, context.fonts.body, 32, 600), wordBreak: "break-word", color: palette.muted } }, context.brand.name),
      ),
      frame.counter === null ? null : h("div", { style: { ...text(context, context.fonts.body, 32, 600), wordBreak: "break-word", color: palette.muted } }, frame.counter),
    ),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", marginTop: px(context, 32), marginBottom: px(context, 32) } },
      ...frame.content,
    ),
    hasFooter
      ? h(
          "div",
          { style: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: px(context, 28) } },
          frame.cta === undefined
            ? null
            : h(
                "div",
                {
                  style: {
                    ...text(context, context.fonts.body, 34, 600),
                    wordBreak: "break-word",
                    maxWidth: "100%",
                    padding: `${px(context, 18)}px ${px(context, 36)}px`,
                    borderRadius: px(context, 999),
                    backgroundColor: palette.cta,
                    color: palette.onCta,
                  },
                },
                frame.cta,
              ),
          frame.source === undefined ? null : h("div", { style: { ...text(context, context.fonts.body, 24, 400), wordBreak: "break-word", lineHeight: 1.3, color: palette.muted } }, frame.source),
        )
      : null,
  );
}

export function portraitEyebrow(context: OgTemplateContext, value: string | undefined): OgNode | null {
  if (value === undefined) return null;
  return h("div", { style: { ...text(context, context.fonts.body, 34, 600), wordBreak: "break-word", color: context.palette.accent, marginBottom: px(context, 24) } }, value);
}

/** The portrait headline size: shorter headlines get bigger type. */
export function portraitHeadlineSize(headline: string): number {
  if (headline.length <= 30) return 84;
  if (headline.length <= 60) return 70;
  return 60;
}

export function portraitHeadline(context: OgTemplateContext, value: string): OgNode {
  return h("div", { style: { ...text(context, context.fonts.heading, portraitHeadlineSize(value), 700), wordBreak: "break-word", lineHeight: 1.12, color: context.palette.foreground } }, value);
}

/** Up to two figures in boxes side by side: the value large, the label under it. */
export function portraitTiles(context: OgTemplateContext, entries: readonly Tile[]): OgNode | null {
  if (entries.length === 0) return null;
  const { palette } = context;
  const gap = px(context, 20);
  // Two per row: half of the content width (the frame's padding off both sides) minus half the gap.
  const tileWidth = Math.floor((context.width - 2 * px(context, PADDING) - gap) / 2);
  return h(
    "div",
    { style: { display: "flex", flexWrap: "wrap", gap, marginTop: px(context, 40) } },
    ...entries.map((tile) =>
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            width: tileWidth,
            padding: `${px(context, 22)}px ${px(context, 28)}px`,
            borderRadius: px(context, 24),
            border: `${px(context, 2)}px solid ${palette.border}`,
            backgroundColor: palette.surface,
          },
        },
        h("div", { style: { ...text(context, context.fonts.heading, 44, 700), wordBreak: "break-word", color: palette.foreground } }, tile.value),
        h("div", { style: { ...text(context, context.fonts.body, 28, 400), wordBreak: "break-word", color: palette.muted, marginTop: px(context, 6) } }, tile.label),
      ),
    ),
  );
}
