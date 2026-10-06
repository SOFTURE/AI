import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, mergeThemes } from "../src/index.js";
import { checkThemeContrast, type ContrastPair, DEFAULT_CONTRAST_PAIRS } from "../src/testing/index.js";

describe("the default tokens (a token change that breaks contrast fails here)", () => {
  it("pass every pair the components paint, in both schemes", () => {
    expect(checkThemeContrast(DEFAULT_CONTRAST_PAIRS)).toEqual([]);
  });

  it("are caught when a token drops below its minimum (sabotage)", () => {
    const darkened = mergeThemes(DEFAULT_THEME, { light: { "color-muted": "#8a8f98" } });
    const failures = checkThemeContrast(DEFAULT_CONTRAST_PAIRS, darkened);
    expect(failures.map((failure) => `${failure.scheme} ${failure.pair}`)).toEqual([
      "light color-muted on color-background",
      "light color-muted on color-surface",
      "light color-muted on color-surface-raised",
    ]);
    const [first] = failures;
    expect(first?.kind === "low-contrast" && first.ratio).toBeCloseTo(3.03, 2);
    expect(first?.kind === "low-contrast" && first.minimum).toBe(4.5);
  });
});

describe("checkThemeContrast", () => {
  const schemes = {
    light: { ink: "#767676", paper: "#ffffff", line: "#949494", alarm: "#be123c", tinted: "var(--x)" },
    dark: { ink: "#ffffff", paper: "#000000", line: "#555555", alarm: "#f87171" },
  } as const;

  it("works on the caller's own token names and grades by use and level", () => {
    const pairs: ContrastPair<keyof typeof schemes.light>[] = [
      { foreground: "ink", background: "paper", use: "text" },
      { foreground: "line", background: "paper", use: "non-text" },
      { foreground: "ink", background: "paper", use: "text", level: "AAA" },
    ];
    const failures = checkThemeContrast(pairs, schemes).map((failure) =>
      failure.kind === "low-contrast"
        ? `${failure.scheme} ${failure.pair}: ${failure.ratio.toFixed(2)} < ${failure.minimum}`
        : failure.kind,
    );
    expect(failures).toEqual(["light ink on paper: 4.54 < 7", "dark line on paper: 2.82 < 3"]);
  });

  it("composites a tinted background over its ground before measuring", () => {
    const pair: ContrastPair<"alarm" | "paper"> = {
      foreground: "alarm",
      background: { tint: "alarm", alpha: 0.1, over: "paper" },
      use: "text",
    };
    expect(checkThemeContrast([pair], schemes)).toEqual([]);
    const failures = checkThemeContrast([{ ...pair, background: { tint: "alarm", alpha: 0.9, over: "paper" } }], schemes);
    expect(failures.map((failure) => `${failure.scheme} ${failure.pair}`)).toEqual([
      "light alarm on alarm/90 over paper",
      "dark alarm on alarm/90 over paper",
    ]);
  });

  it("reports a missing token and a value it cannot read instead of guessing", () => {
    expect(
      checkThemeContrast(
        [
          { foreground: "alarm", background: "tinted", use: "text" },
          { foreground: "ink", background: "missing", use: "text" },
        ],
        schemes as Record<"light" | "dark", Partial<Record<string, string>>>,
      ),
    ).toEqual([
      { kind: "unreadable-color", scheme: "light", pair: "alarm on tinted", token: "tinted", value: "var(--x)" },
      { kind: "missing-token", scheme: "light", pair: "ink on missing", token: "missing" },
      { kind: "missing-token", scheme: "dark", pair: "alarm on tinted", token: "tinted" },
      { kind: "missing-token", scheme: "dark", pair: "ink on missing", token: "missing" },
    ]);
  });

  it("returns nothing for no pairs", () => {
    expect(checkThemeContrast([])).toEqual([]);
  });
});

describe("DEFAULT_CONTRAST_PAIRS", () => {
  it("guards text on every ground, the accent fill and the focus ring", () => {
    const labels = DEFAULT_CONTRAST_PAIRS.map(
      (pair) => `${pair.use}: ${pair.foreground} on ${typeof pair.background === "string" ? pair.background : `${pair.background.tint}/${pair.background.alpha * 100} over ${pair.background.over}`}`,
    );
    expect(labels).toContain("text: color-muted on color-surface-raised");
    expect(labels).toContain("text: color-on-accent on color-accent-fill-hover");
    expect(labels).toContain("text: color-danger on color-danger/10 over color-surface");
    expect(labels).toContain("non-text: color-focus on color-background");
    expect(labels).toContain("non-text: color-border-strong on color-surface");
  });
});

describe("the root entry", () => {
  it("does not re-export the testing helpers (they stay out of app bundles)", () => {
    const source = readFileSync(join(import.meta.dirname, "../src/index.ts"), "utf8");
    expect(source).not.toMatch(/testing/);
  });
});
