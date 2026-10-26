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

  it("merges the theme's text styles with Tailwind's sizes as one kind in cn", () => {
    expect(flatPaint.cn("text-sm", "text-subsection")).toBe("text-subsection");
    expect(flatPaint.cn("text-subsection", "text-muted")).toBe("text-subsection text-muted");
  });

  it("gives the hint the 8 px gap and a trigger with the accent focus ring", () => {
    expect(flatPaint.HINT_LOOK.triggerGap).toBe(8);
    expect(flatPaint.HINT_LOOK.classNames.trigger).toContain("focus-visible:ring-accent");
    expect(flatPaint.HINT_LOOK.classNames.bubble).toBe("rounded-md");
  });

  it("draws a done checklist item from the data-done ui sets on the item", () => {
    expect(flatPaint.CHECKLIST_LOOK.marker).toContain("in-data-done:bg-accessible/20");
    expect(flatPaint.CHECKLIST_LOOK.label).toBe("in-data-done:font-normal in-data-done:text-muted in-data-done:line-through");
  });

  it("draws each stepper state from the data-state ui sets on the item", () => {
    for (const className of ["in-data-[state=current]:border-accent", "in-data-[state=done]:bg-accent-fill", "sm:size-10"]) {
      expect([className, flatPaint.STEPPER_LOOK.marker?.split(" ").includes(className)]).toEqual([className, true]);
    }
    expect(flatPaint.STEPPER_LOOK.label).toContain("sr-only sm:not-sr-only");
  });

  it("gives a menu the ghost button trigger and a flat panel", () => {
    expect(flatPaint.MENU_PANEL_LOOK.trigger).toBe(flatPaint.BUTTON_VARIANT_LOOK.ghost);
    expect(flatPaint.MENU_PANEL_LOOK.panel).toContain("shadow-none");
  });

  it("frames a picked colour preset instead of ringing it", () => {
    expect(flatPaint.COLOR_FIELD_LOOK.preset).toContain("aria-checked:border-foreground");
    expect(flatPaint.COLOR_FIELD_LOOK.swatch).toBe("h-9 w-7 border-line-strong bg-surface-raised");
  });
});
