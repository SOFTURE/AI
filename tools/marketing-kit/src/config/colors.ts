/**
 * The colour roles a film paints with. Every role resolves to a hex literal before anything is
 * recorded, from the config, the app's stylesheet or a `design.json`.
 */

export const COLOR_ROLES = [
  /** The frame behind the phone and the vignette; `#rrggbb`, because the vignette appends an alpha. */
  "background",
  /** Text on the background: the persona card's name, the end card. */
  "foreground",
  /** Secondary text: the persona card's tagline, the end card's note. */
  "muted",
  /** The touch ring and the end of the avatar's gradient. */
  "accent",
  /** The end card's link pill and the start of the avatar's gradient. */
  "cta",
  /** Text on `cta`. */
  "onCta",
  /** The caption pill. */
  "captionBackground",
  /** Caption words not spoken yet. */
  "captionText",
  /** The word being spoken. */
  "captionHighlight",
] as const;

export type ColorRole = (typeof COLOR_ROLES)[number];

/**
 * Colour roles a brand may leave out: only a feature that asks for them needs them, so a brand without them still
 * resolves (issue #1199).
 */
export const OPTIONAL_COLOR_ROLES = [
  /** The box behind the word being spoken, with `captionHighlightStyle: "box"`. */
  "captionHighlightBox",
  /** The text of the word being spoken on its box, with `captionHighlightStyle: "box"`. */
  "captionHighlightText",
] as const;

export type OptionalColorRole = (typeof OPTIONAL_COLOR_ROLES)[number];

export type BrandColors = Record<ColorRole, string> & Partial<Record<OptionalColorRole, string>>;

export const COLOR_THEMES = ["light", "dark"] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number];

/** Colours read from a source, keyed by the source's token name. */
export type ColorsResult = { ok: true; colors: Record<string, string> } | { ok: false; error: string };

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const OPAQUE_HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/** `#rrggbb` only: the background gets an alpha appended for the vignette. */
export function isOpaqueHexColor(value: string): boolean {
  return OPAQUE_HEX_COLOR.test(value);
}

/** The token a role reads from a source when the config names none: `onCta` → `on-cta`. */
export function getDefaultToken(role: ColorRole | OptionalColorRole): string {
  return role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** `#abc`, `#abcd`, `#aabbcc` or `#aabbccdd` as `#aabbcc` (lower case, alpha dropped). */
function toOpaque(color: string): string {
  const digits = color.replace(/^#/, "").toLowerCase();
  const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join("") : digits;
  return `#${full.slice(0, 6)}`;
}

/** The relative luminance (WCAG 2) of a hex colour, its alpha ignored. */
export function getRelativeLuminance(color: string): number {
  if (!isHexColor(color)) throw new Error(`Not a hex colour: "${color}".`);
  const hex = toOpaque(color);
  const channel = (offset: number): number => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** The WCAG contrast ratio of two hex colours (alpha ignored), from 1 to 21. */
export function getContrastRatio(first: string, second: string): number {
  const [lighter, darker] = [getRelativeLuminance(first), getRelativeLuminance(second)].sort((a, b) => b - a) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}
