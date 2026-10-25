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
});
