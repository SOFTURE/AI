import { h } from "../element.js";
import { withAlpha } from "../palette.js";
import type { OgTemplate } from "./context.js";
import { eyebrow, frame, headline, px, tiles } from "./frame.js";
import type { HeadlineChartData } from "./schemas.js";

/** A filled shape's tint: its tone at 20 % alpha. */
const FILL_ALPHA = 0x33;

/** A headline beside a chart the app computed; figures under the headline. */
export const headlineChartTemplate: OgTemplate<HeadlineChartData> = {
  build(data, context) {
    const [viewWidth, viewHeight] = data.chart.viewBox;
    const chartWidth = px(context, 480);
    const chartHeight = Math.round((chartWidth * viewHeight) / viewWidth);
    const paths = data.chart.paths.map((path) => {
      const color = context.palette[path.tone];
      return h("path", {
        d: path.d,
        fill: path.fill ? withAlpha(color, FILL_ALPHA) : "none",
        stroke: path.fill ? "none" : color,
        strokeWidth: path.strokeWidth ?? viewWidth / 100,
        strokeLinecap: "round",
        strokeLinejoin: "round",
      });
    });
    return frame(context, [
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: px(context, 48) } },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", flexShrink: 1, flexBasis: 0, flexGrow: 1 } },
          eyebrow(context, data.eyebrow),
          headline(context, data.headline),
          tiles(context, data.tiles, "row"),
        ),
        h("svg", { width: chartWidth, height: chartHeight, viewBox: `0 0 ${viewWidth} ${viewHeight}`, style: { flexShrink: 0 } }, ...paths),
      ),
    ]);
  },
};
