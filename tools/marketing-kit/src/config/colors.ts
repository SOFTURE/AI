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

export type BrandColors = Record<ColorRole, string>;

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
export function getDefaultToken(role: ColorRole): string {
  return role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
