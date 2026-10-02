import { describe, expect, it } from "vitest";
import { themeFromDesignJson } from "../src/index.js";

// The shape of FIRE_TRACKER's `.impeccable/design.json` (schemaVersion 2), trimmed to what matters.
const FIRE_DESIGN = {
  schemaVersion: 2,
  title: "Design System",
  themes: {
    default: "system",
    light: {
      colorScheme: "light",
      themeColor: "#f6f7f8",
      roles: {
        background: "#f6f7f8",
        surface: "#ffffff",
        "surface-raised": "#ffffff",
        border: "#e6e7ea",
        "line-strong": "#8a8f98",
        foreground: "#16171a",
        muted: "#5b606b",
        accent: "#356912",
        "accent-fill": "#cff26b",
        "accent-fill-hover": "#bfe654",
        "on-accent": "#0c0c0d",
        accessible: "#0f766e",
        locked: "#b45309",
        debt: "#be123c",
      },
    },
    dark: {
      roles: { background: "#0c0c0d", foreground: "#f2f3f5", danger: "#f87171" },
    },
  },
  extensions: { colorMeta: {} },
};

describe("themeFromDesignJson", () => {
  it("maps the known roles per scheme and reports the rest as ignored", () => {
    const result = themeFromDesignJson(FIRE_DESIGN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value.theme.light ?? {})).toHaveLength(11);
    expect(result.value.theme.light?.["color-border-strong"]).toBe("#8a8f98");
    expect(result.value.theme.light?.["color-accent-fill-hover"]).toBe("#bfe654");
    expect(result.value.theme.dark).toEqual({
      "color-background": "#0c0c0d",
      "color-foreground": "#f2f3f5",
      "color-danger": "#f87171",
    });
    expect(result.value.ignoredRoles).toEqual(["light.accessible", "light.locked", "light.debt"]);
  });

  it("accepts a design with one scheme only", () => {
    const result = themeFromDesignJson({ schemaVersion: 2, themes: { dark: { roles: { accent: "#ff0000" } } } });
    expect(result).toEqual({
      ok: true,
      value: { theme: { dark: { "color-accent": "#ff0000" } }, ignoredRoles: [] },
    });
  });

  it("rejects an unsupported schema version", () => {
    expect(themeFromDesignJson({ schemaVersion: 1, themes: {} })).toEqual({
      ok: false,
      error: "ui.design_json_unsupported_version",
    });
  });

  it.each([
    ["not an object", "design.json"],
    ["null", null],
    ["no themes", { schemaVersion: 2 }],
    ["a non-string role", { schemaVersion: 2, themes: { light: { roles: { accent: 3 } } } }],
    ["an unsafe role value", { schemaVersion: 2, themes: { light: { roles: { accent: "red;}" } } } }],
  ])("rejects %s", (_label, input) => {
    expect(themeFromDesignJson(input)).toEqual({ ok: false, error: "ui.design_json_invalid" });
  });
});
