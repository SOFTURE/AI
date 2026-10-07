import { h } from "../element.js";
import type { OgTemplate } from "./context.js";
import { px, text } from "./frame.js";
import { portraitEyebrow, portraitFrame, portraitHeadline, portraitTiles } from "./portrait.js";
import type { CarouselData } from "./schemas.js";

/** One slide of a numbered run: every slide shares the frame, the counter says where the reader is. */
export const carouselTemplate: OgTemplate<CarouselData> = {
  build(data, context, slide) {
    const current = data.slides[slide - 1];
    // `buildOgTree` checks `slide` against `countSlides` before it calls `build`, so this is a bug.
    if (current === undefined) throw new Error(`carousel: no slide ${String(slide)} of ${String(data.slides.length)}`);
    return portraitFrame(context, {
      counter: data.counter ? `${String(slide)}/${String(data.slides.length)}` : null,
      cta: current.cta,
      source: current.source,
      content: [
        portraitEyebrow(context, current.eyebrow),
        portraitHeadline(context, current.headline),
        current.body === undefined
          ? null
          : h("div", { style: { ...text(context, context.fonts.body, 40, 400), wordBreak: "break-word", lineHeight: 1.35, color: context.palette.muted, marginTop: px(context, 32) } }, current.body),
        portraitTiles(context, current.tiles),
      ],
    });
  },
};
