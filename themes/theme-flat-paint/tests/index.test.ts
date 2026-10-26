import { describe, expect, it } from "vitest";

import * as flatPaint from "../src/index.js";

describe("@softure-ai/theme-flat-paint", () => {
  it("exports no undefined value", () => {
    expect(Object.entries(flatPaint).filter(([, value]) => value === undefined)).toEqual([]);
  });

  it("exports the theme under its own name and the standard one", () => {
    expect(flatPaint.theme).toBe(flatPaint.FLAT_PAINT_THEME);
  });

  it("builds an icon button's look from its size and tone", () => {
    expect(flatPaint.getIconButtonLook("sm", "danger")).toBe(
      "rounded-md focus-visible:outline-offset-0 focus-visible:outline-debt/60",
    );
    expect(flatPaint.getIconButtonLook("lg", "neutral")).toBe("focus-visible:outline-offset-0");
  });

  it("maps each data role onto the ui tone the bridge paints in its colour", () => {
    expect(flatPaint.ROLE_TONE).toEqual({ accessible: "success", locked: "warning", debt: "danger" });
  });

  it("builds a chart flag's look from its look and size", () => {
    expect(flatPaint.getChartFlagLook("deep", "sm")).toBe(
      "bg-lime-deep text-paper rounded-flag px-1.5 py-0.5 text-[0.6875rem] whitespace-nowrap font-bold tabular-nums",
    );
    expect(flatPaint.getChartFlagLook("accent", "md")).toBe(
      "bg-accent-fill text-on-accent rounded-md px-2 py-1 text-xs whitespace-nowrap font-bold tabular-nums",
    );
  });

  it("rings a chart pin's dot per surface and colours the package's dash instead of adding a border", () => {
    expect(flatPaint.CHART_PIN_LOOK.ring).toEqual({ page: "border-foreground", dark: "border-ink", paper: "border-paper" });
    expect(Object.values(flatPaint.CHART_PIN_LOOK.line).filter((look) => look.includes("border"))).toEqual([]);
    expect(flatPaint.CHART_PIN_LOOK.line.paper).toContain("var(--sft-chart-axis)_70%");
  });

  it("maps each chart role onto the charts tone that paints it", () => {
    expect(flatPaint.CHART_ROLE_TONE).toEqual({
      accessible: "success",
      locked: "warning",
      debt: "danger",
      accent: "accent",
      muted: "muted",
    });
  });

  it("merges the theme's text styles with Tailwind's sizes as one kind in cn", () => {
    expect(flatPaint.cn("text-sm", "text-subsection")).toBe("text-subsection");
    expect(flatPaint.cn("text-subsection", "text-muted")).toBe("text-subsection text-muted");
  });
});
