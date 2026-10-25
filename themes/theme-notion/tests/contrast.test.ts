import { isColorAlias, type ColorValue } from "@softure-ai/theme-kit";
import { describe, expect, it } from "vitest";

import { NOTION_THEME, PALETTE_COLORS } from "../src/index.js";

// WCAG 2.2 AA: 4.5:1 for text (SC 1.4.3), 3:1 for control boundaries, states and the focus ring (SC 1.4.11).
const TEXT_MIN = 4.5;
const NON_TEXT_MIN = 3;

type Scheme = "light" | "dark";
type Rgb = readonly [number, number, number];

// A layer is a colour token, optionally with a Tailwind opacity modifier (`destructive/60`).
interface Pair {
  readonly text: string;
  // The surface from the bottom layer up; each layer is composited over the ones below it.
  readonly on: readonly string[];
  // The layers the text or indicator is painted over, when they differ from `on` (a border clipped outside its
  // element's fill sits on what surrounds the element); defaults to `on`.
  readonly paintedOn?: readonly string[];
  readonly min: number;
  readonly schemes?: readonly Scheme[];
}

function getTokenValue(name: string, scheme: Scheme): string {
  const value: ColorValue | undefined = (NOTION_THEME.colors as Readonly<Record<string, ColorValue>>)[name];
  if (value === undefined) throw new Error(`Unknown colour token "${name}"`);
  return isColorAlias(value) ? getTokenValue(value.alias, scheme) : value[scheme];
}

function parseColor(css: string): { rgb: Rgb; alpha: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(css);
  if (hex?.[1] !== undefined) {
    const digits = hex[1];
    return { rgb: [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as unknown as Rgb, alpha: 1 };
  }
  const rgba = /^rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)$/.exec(css);
  if (rgba === null) throw new Error(`Cannot parse colour "${css}"`);
  return { rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])], alpha: rgba[4] === undefined ? 1 : Number(rgba[4]) };
}

function composite(layer: string, below: Rgb, scheme: Scheme): Rgb {
  const [name = "", modifier] = layer.split("/");
  const { rgb, alpha } = parseColor(getTokenValue(name, scheme));
  const opacity = alpha * (modifier === undefined ? 1 : Number(modifier) / 100);
  return rgb.map((channel, i) => channel * opacity + (below[i] ?? 0) * (1 - opacity)) as unknown as Rgb;
}

function getLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as unknown as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrast(pair: Pair, scheme: Scheme): number {
  const flatten = (layers: readonly string[]): Rgb =>
    layers.reduce<Rgb>((below, layer) => composite(layer, below, scheme), [255, 255, 255]);
  const surface = flatten(pair.on);
  const text = composite(pair.text, flatten(pair.paintedOn ?? pair.on), scheme);
  const [lighter, darker] = [getLuminance(text), getLuminance(surface)].sort((a, b) => b - a) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

// The page surfaces text sits on: plain, raised, tinted, and a hovered or focused row on each.
const SURFACES: readonly (readonly string[])[] = [
  ["background"],
  ["card"],
  ["popover"],
  ["muted"],
  ["secondary"],
  ["sidebar"],
  ["background", "accent"],
  ["popover", "accent"],
  ["secondary", "accent"],
  ["sidebar", "sidebar-accent"],
  ["background", "field"],
  ["background", "muted/50"],
];

// The page surfaces a control sits on.
const CONTROL_SURFACES: readonly (readonly string[])[] = [
  ["background"],
  ["card"],
  ["popover"],
  ["muted"],
  ["secondary"],
  ["sidebar"],
];

// The progress fills: the default (the link blue in dark) and the `StatCard` tone fills.
const PROGRESS_FILLS: readonly Pair[] = [
  { text: "primary", on: [], min: NON_TEXT_MIN, schemes: ["light"] },
  { text: "link", on: [], min: NON_TEXT_MIN, schemes: ["dark"] },
  ...["gray", "green", "orange", "red"].map((text) => ({ text, on: [], min: NON_TEXT_MIN })),
];

// The selected tab's pill on the `muted` list: the page background in light, a lifted `accent` in dark.
const SELECTED_TAB_FILLS: readonly { fill: string; schemes: readonly Scheme[] }[] = [
  { fill: "background", schemes: ["light"] },
  { fill: "accent/40", schemes: ["dark"] },
];

// SC 1.4.11: what identifies a control and its state, against what surrounds it. Decorative separators (`border`,
// `sidebar-border`) are not listed: they only separate content.
const NON_TEXT_PAIRS: readonly Pair[] = [
  // The boundary of Input, Textarea, SelectTrigger and InputGroup; the Switch off track (and the bridge's
  // `border-strong` for the package fields).
  ...["input", "control-off"].flatMap((text) => CONTROL_SURFACES.map((on) => ({ text, on, min: NON_TEXT_MIN }))),
  // The Switch thumb on its off and on track.
  ...CONTROL_SURFACES.flatMap((on) => [
    { text: "background", on: [...on, "control-off"], min: NON_TEXT_MIN },
    { text: "background", on: [...on, "primary"], min: NON_TEXT_MIN },
  ]),
  // A checked Switch track and Checkbox.
  ...[["background"], ["card"], ["popover"], ["muted"]].map((on) => ({ text: "primary", on, min: NON_TEXT_MIN })),
  // The Progress fill against its track, which is a quiet extent: the fill carries the value.
  ...PROGRESS_FILLS.flatMap((fill) =>
    CONTROL_SURFACES.map((on) => ({ ...fill, on: [...on, "primary/20"] })),
  ),
  // The selected tab of the default Tabs variant: its `input` border, painted over the list (`bg-clip-padding`),
  // against the list (and the unselected tabs on it) and against the pill's own fill.
  ...SELECTED_TAB_FILLS.flatMap(({ fill, schemes }) => [
    { text: "input", on: ["muted"], min: NON_TEXT_MIN, schemes },
    { text: "input", on: ["muted", fill], paintedOn: ["muted"], min: NON_TEXT_MIN, schemes },
  ]),
];

// Every text/background pair the theme's own parts render (`src/ui`, `src/notion`), in both schemes unless noted.
const PAIRS: readonly Pair[] = [
  ...["foreground", "muted-foreground"].flatMap((text) => SURFACES.map((on) => ({ text, on, min: TEXT_MIN }))),
  ...["blue-bg", "yellow-bg", "gray-bg"].map((bg) => ({ text: "foreground", on: [bg], min: TEXT_MIN })),
  // Steps: a current step's note.
  { text: "muted-foreground", on: ["blue-bg"], min: TEXT_MIN },
  { text: "sidebar-foreground", on: ["sidebar"], min: TEXT_MIN },
  { text: "sidebar-accent-foreground", on: ["sidebar", "sidebar-accent"], min: TEXT_MIN },
  // Button and Badge default, Checkbox, Steps current, Avatar badge.
  { text: "primary-foreground", on: ["primary"], min: TEXT_MIN },
  { text: "primary-foreground", on: ["primary-hover"], min: TEXT_MIN },
  { text: "sidebar-primary-foreground", on: ["sidebar-primary"], min: TEXT_MIN },
  // Button and Badge destructive: the full fill in light, shadcn/ui's dimmed fill in dark.
  { text: "destructive-foreground", on: ["destructive"], min: TEXT_MIN, schemes: ["light"] },
  { text: "destructive-foreground", on: ["background", "destructive/90"], min: TEXT_MIN, schemes: ["light"] },
  { text: "destructive-foreground", on: ["background", "destructive/60"], min: TEXT_MIN, schemes: ["dark"] },
  { text: "destructive-foreground", on: ["background", "destructive/50"], min: TEXT_MIN, schemes: ["dark"] },
  // Alert destructive, field errors, a destructive menu item and its focused row.
  ...[["background"], ["card"], ["popover"], ["muted"], ["popover", "destructive/10"]].map((on) => ({
    text: "destructive",
    on,
    min: TEXT_MIN,
  })),
  // Inline Code: the code red on its grey chip.
  { text: "code-foreground", on: ["secondary"], min: TEXT_MIN },
  // Link variants and hovered inline links.
  ...[["background"], ["card"], ["popover"], ["muted"]].map((on) => ({ text: "link", on, min: TEXT_MIN })),
  { text: "tooltip-foreground", on: ["tooltip"], min: TEXT_MIN },
  // Status and tone figures: palette text on the page surfaces.
  ...PALETTE_COLORS.flatMap((color) =>
    [["background"], ["card"], ["popover"]].map((on) => ({ text: color, on, min: TEXT_MIN })),
  ),
  ...PALETTE_COLORS.map((color) => ({ text: color, on: ["muted"], min: TEXT_MIN, schemes: ["light"] as const })),
  // Badges in a palette colour.
  ...PALETTE_COLORS.map((color) => ({ text: `${color}-tag-foreground`, on: [`${color}-tag`], min: TEXT_MIN })),
  { text: "default-tag-foreground", on: ["default-tag"], min: TEXT_MIN },
  // The focus ring against the page.
  ...[["background"], ["card"], ["popover"]].map((on) => ({ text: "ring", on, min: NON_TEXT_MIN })),
  ...NON_TEXT_PAIRS,
];

describe("Notion theme contrast (WCAG 2.2 AA)", () => {
  it.each(["light", "dark"] as const)("meets the minimum for every pair the parts render in %s", (scheme) => {
    const failures = PAIRS.filter((pair) => (pair.schemes ?? ["light", "dark"]).includes(scheme))
      .map((pair) => ({ pair: `${pair.text} on ${pair.on.join(" + ")}`, ratio: getContrast(pair, scheme), min: pair.min }))
      .filter(({ ratio, min }) => ratio < min)
      .map(({ pair, ratio }) => `${pair}: ${ratio.toFixed(2)}`);
    expect(failures).toEqual([]);
  });

  it("keeps primary-hover darker than primary, so hover reads as a press", () => {
    const white = { text: "primary-foreground", min: 0 };
    expect(getContrast({ ...white, on: ["primary-hover"] }, "light")).toBeGreaterThan(getContrast({ ...white, on: ["primary"] }, "light"));
  });
});
