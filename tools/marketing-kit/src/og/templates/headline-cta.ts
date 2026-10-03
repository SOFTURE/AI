import { h } from "../element.js";
import type { OgTemplate } from "./context.js";
import { eyebrow, frame, headline, px, text, tiles } from "./frame.js";
import type { HeadlineCtaData } from "./schemas.js";

/** A headline, up to four figures and a call to action: the classic share card. */
export const headlineCtaTemplate: OgTemplate<HeadlineCtaData> = {
  build(data, context) {
    const { palette } = context;
    return frame(context, [
      eyebrow(context, data.eyebrow),
      headline(context, data.headline),
      tiles(context, data.tiles, "row"),
      data.cta === undefined
        ? null
        : h(
            "div",
            { style: { display: "flex", marginTop: px(context, 40) } },
            h(
              "div",
              {
                style: {
                  ...text(context, context.fonts.body, 28, 600),
                  padding: `${px(context, 16)}px ${px(context, 32)}px`,
                  borderRadius: px(context, 999),
                  backgroundColor: palette.cta,
                  color: palette.onCta,
                },
              },
              data.cta,
            ),
          ),
    ]);
  },
};
