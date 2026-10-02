import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, SCHEME_TOKENS, SHARED_TOKENS, tokenVar } from "../src/index.js";

describe("token contract", () => {
  it("names every token once, in kebab case", () => {
    const names = [...SCHEME_TOKENS, ...SHARED_TOKENS];
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
  });

  it("covers the docs/02 colour roles plus border-strong and accent-fill-hover", () => {
    const colors = SCHEME_TOKENS.filter((name) => name.startsWith("color-")).map((name) => name.slice(6));
    expect(colors.sort()).toEqual(
      [
        "accent",
        "accent-fill",
        "accent-fill-hover",
        "background",
        "border",
        "border-strong",
        "danger",
        "focus",
        "foreground",
        "muted",
        "on-accent",
        "success",
        "surface",
        "surface-raised",
        "warning",
      ].sort(),
    );
  });

  it("has a light and a dark default for every scheme token and a default for every shared token", () => {
    expect(Object.keys(DEFAULT_THEME.light).sort()).toEqual([...SCHEME_TOKENS].sort());
    expect(Object.keys(DEFAULT_THEME.dark).sort()).toEqual([...SCHEME_TOKENS].sort());
    expect(Object.keys(DEFAULT_THEME.shared).sort()).toEqual([...SHARED_TOKENS].sort());
  });

  it("keeps the scale tokens in their documented ranges", () => {
    expect(SHARED_TOKENS.filter((name) => name.startsWith("space-"))).toEqual(
      ["1", "2", "3", "4", "5", "6", "7", "8"].map((step) => `space-${step}`),
    );
    expect(DEFAULT_THEME.shared["space-4"]).toBe("1rem");
    expect(DEFAULT_THEME.shared["duration-fast"]).toBe("160ms");
  });

  it("prefixes the CSS variable with --sft-", () => {
    expect(tokenVar("color-accent")).toBe("--sft-color-accent");
  });
});
