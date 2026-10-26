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

  it("gives a dialog the rising panel and a side panel the one from the right, both on the flat veil", () => {
    expect(flatPaint.getModalLook("form")).toBe(flatPaint.MODAL_LOOK);
    expect(flatPaint.getModalLook("confirmation")).toBe(flatPaint.MODAL_LOOK);
    expect(flatPaint.getModalLook("panel")).toBe(flatPaint.STANDING_PANEL_LOOK);
    expect(flatPaint.MODAL_LOOK).toEqual({
      overlay: "bg-ink/60 veil-enter transition-none",
      panel: "shadow-none normal-case transition-none dialog-enter",
      header: "items-center",
      title: "text-page",
      close: "rounded-md focus-visible:outline-offset-0",
    });
    expect(flatPaint.STANDING_PANEL_LOOK.panel).toBe("shadow-none normal-case transition-none side-panel-enter");
    expect(flatPaint.STANDING_PANEL_LOOK.overlay).toBe(flatPaint.MODAL_LOOK.overlay);
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

  it("lets a selected row's surface and bar win over the row's in cn", () => {
    const row = flatPaint.cn(flatPaint.DATA_TABLE_LOOK.row, flatPaint.DATA_TABLE_LOOK.selectedRow).split(" ");
    expect(row).toContain("bg-surface-raised");
    expect(row).toContain("shadow-selected-row");
    expect(row).not.toContain("bg-surface");
  });

  it("merges the theme's text styles with Tailwind's sizes as one kind in cn", () => {
    expect(flatPaint.cn("text-sm", "text-subsection")).toBe("text-subsection");
    expect(flatPaint.cn("text-subsection", "text-muted")).toBe("text-subsection text-muted");
  });
});
