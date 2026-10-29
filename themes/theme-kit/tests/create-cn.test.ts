import { describe, expect, it } from "vitest";

import { createCn, createThemeCn } from "../src/index.js";

describe("createCn", () => {
  it("joins class names and lets a later utility of the same kind win", () => {
    const cn = createCn();
    expect(cn("px-2 py-1", false, undefined, ["px-4"])).toBe("py-1 px-4");
  });

  it("keeps a named text style next to a text colour, and a later named shadow replaces an earlier one", () => {
    const cn = createCn({ textStyles: ["body"], shadows: ["menu", "card"] });
    expect(cn("text-body text-muted-foreground")).toBe("text-body text-muted-foreground");
    expect(cn("shadow-menu", "shadow-card")).toBe("shadow-card");
  });

  it("without the names, merges the text style into the colour as tailwind-merge does by default", () => {
    expect(createCn()("text-body text-muted-foreground")).toBe("text-muted-foreground");
  });

  it("lets a later named size replace an earlier numeric one of the same utility, and the reverse", () => {
    const cn = createCn({ sizes: ["row-height", "control-height", "touch-target"] });
    expect(cn("min-h-7", "min-h-row-height")).toBe("min-h-row-height");
    expect(cn("h-7", "h-control-height")).toBe("h-control-height");
    expect(cn("size-7", "size-touch-target")).toBe("size-touch-target");
    expect(cn("size-touch-target", "size-7")).toBe("size-7");
  });

  it("keeps a named size next to a named text style and a utility of another kind", () => {
    const cn = createCn({ textStyles: ["body"], sizes: ["row-height"] });
    expect(cn("text-body h-row-height min-h-7")).toBe("text-body h-row-height min-h-7");
  });

  it("without the names, keeps both the numeric and the named size", () => {
    expect(createCn()("size-7", "size-touch-target")).toBe("size-7 size-touch-target");
  });
});

describe("createThemeCn", () => {
  it("takes the text styles and shadows from a theme definition", () => {
    const cn = createThemeCn({
      textStyles: { ui: { fontSize: "14px", lineHeight: "20px", fontWeight: 400 } },
      shadows: { dialog: { light: "none", dark: "none" }, card: { light: "none", dark: "none" } },
    });
    expect(cn("text-ui text-foreground shadow-dialog", "shadow-card")).toBe("text-ui text-foreground shadow-card");
  });

  it("takes the sizes from a theme definition as spacing values", () => {
    const cn = createThemeCn({
      textStyles: {},
      shadows: {},
      sizes: { "row-height": "28px", "control-height": "28px", "touch-target": "44px" },
    });
    expect(cn("min-h-7", "min-h-row-height")).toBe("min-h-row-height");
    expect(cn("h-7", "h-control-height")).toBe("h-control-height");
    expect(cn("size-7", "size-touch-target")).toBe("size-touch-target");
  });
});
