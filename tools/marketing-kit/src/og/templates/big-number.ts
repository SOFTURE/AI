import { h } from "../element.js";
import type { OgTemplate } from "./context.js";
import { px, text } from "./frame.js";
import { portraitEyebrow, portraitFrame, portraitTiles } from "./portrait.js";
import type { BigNumberData } from "./schemas.js";

/** The number's size: the fewer characters, the bigger, so a short figure fills the post's width. */
export function bigNumberSize(value: string): number {
  if (value.length <= 4) return 300;
  if (value.length <= 6) return 220;
  if (value.length <= 8) return 180;
  if (value.length <= 10) return 150;
  return 124;
}

/** One figure as the hero of a portrait post, the sentence that explains it, and up to two more figures. */
export const bigNumberTemplate: OgTemplate<BigNumberData> = {
  build(data, context) {
    const { palette } = context;
    return portraitFrame(context, {
      counter: null,
      cta: data.cta,
      source: data.source,
      content: [
        portraitEyebrow(context, data.eyebrow),
        h(
          "div",
          {
            style: {
              ...text(context, context.fonts.heading, bigNumberSize(data.number), 700),
              lineHeight: 1,
              letterSpacing: -px(context, 4),
              color: palette.foreground,
              wordBreak: "break-word",
            },
          },
          data.number,
        ),
        h("div", { style: { ...text(context, context.fonts.body, 48, 600), wordBreak: "break-word", lineHeight: 1.2, color: palette.foreground, marginTop: px(context, 36) } }, data.caption),
        portraitTiles(context, data.tiles),
      ],
    });
  },
};
