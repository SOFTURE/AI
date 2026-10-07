// Colour basics for the guards: hex parsing, compositing and the WCAG 2 contrast ratio.
// Extracted from an adopting app's palette checks (charts roadmap, CH-3).

/** Red, green and blue channels, 0-255. */
export type Rgb = readonly [red: number, green: number, blue: number];

/** What a contrast pair is used for: body text, large text (18pt, or 14pt bold) or a UI component or graphic. */
export type ContrastUse = "text" | "large-text" | "non-text";
export type ContrastLevel = "AA" | "AAA";

/** WCAG 2 minimum ratios: 1.4.3 and 1.4.6 for text, 1.4.11 for non-text (which has no AAA level). */
export const WCAG_CONTRAST = {
  text: { AA: 4.5, AAA: 7 },
  "large-text": { AA: 3, AAA: 4.5 },
  "non-text": { AA: 3 },
} as const satisfies Record<ContrastUse, Partial<Record<ContrastLevel, number>>>;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#rrggbb` or `#rgb` -> channels; `null` for any other value (a `var()`, `rgb()`, a name). */
export function parseHexColor(value: string): Rgb | null {
  if (!HEX_COLOR.test(value)) return null;
  const digits = value.length === 4 ? [...value.slice(1)].map((digit) => digit + digit).join("") : value.slice(1);
  return [
    Number.parseInt(digits.slice(0, 2), 16),
    Number.parseInt(digits.slice(2, 4), 16),
    Number.parseInt(digits.slice(4, 6), 16),
  ];
}

/** Like `parseHexColor`, for callers whose input is a bug when unreadable (a colour written in a test). */
export function readHexColor(value: string): Rgb {
  const rgb = parseHexColor(value);
  if (rgb === null) throw new TypeError(`Expected a #rrggbb or #rgb colour, got ${JSON.stringify(value)}`);
  return rgb;
}

/** Channels -> `#rrggbb`, rounded and clamped to 0-255. */
export function formatHexColor(rgb: Rgb): string {
  return `#${rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0")).join("")}`;
}

/** An sRGB channel (0-255) -> linear light (0-1). */
export function toLinearChannel(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Linear light (0-1) -> an sRGB channel (0-255), clamped. */
export function toSrgbChannel(linear: number): number {
  const value = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

/** `tint` painted over `ground` with opacity `alpha`, the way a browser composites `bg-danger/10`. */
export function blendColors(tint: string, ground: string, alpha: number): string {
  if (!(alpha >= 0 && alpha <= 1)) throw new TypeError(`Expected an opacity from 0 to 1, got ${alpha}`);
  const top = readHexColor(tint);
  const bottom = readHexColor(ground);
  const mix = (index: 0 | 1 | 2): number => top[index] * alpha + bottom[index] * (1 - alpha);
  return formatHexColor([mix(0), mix(1), mix(2)]);
}

/** WCAG 2 relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(color: string): number {
  const [red, green, blue] = readHexColor(color);
  return 0.2126 * toLinearChannel(red) + 0.7152 * toLinearChannel(green) + 0.0722 * toLinearChannel(blue);
}

/** WCAG 2 contrast ratio of two colours, 1 to 21, in either order. */
export function contrastRatio(first: string, second: string): number {
  const luminances = [relativeLuminance(first), relativeLuminance(second)];
  return (Math.max(...luminances) + 0.05) / (Math.min(...luminances) + 0.05);
}

/** The highest WCAG level a ratio reaches for a use, or `fail`. */
export function getContrastLevel(ratio: number, use: ContrastUse): ContrastLevel | "fail" {
  const thresholds: Partial<Record<ContrastLevel, number>> = WCAG_CONTRAST[use];
  if (thresholds.AAA !== undefined && ratio >= thresholds.AAA) return "AAA";
  if (thresholds.AA !== undefined && ratio >= thresholds.AA) return "AA";
  return "fail";
}
