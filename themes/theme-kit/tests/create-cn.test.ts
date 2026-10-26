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
});

describe("createThemeCn", () => {
  it("takes the text styles and shadows from a theme definition", () => {
    const cn = createThemeCn({
      textStyles: { ui: { fontSize: "14px", lineHeight: "20px", fontWeight: 400 } },
      shadows: { dialog: { light: "none", dark: "none" }, card: { light: "none", dark: "none" } },
    });
    expect(cn("text-ui text-foreground shadow-dialog", "shadow-card")).toBe("text-ui text-foreground shadow-card");
  });
});
