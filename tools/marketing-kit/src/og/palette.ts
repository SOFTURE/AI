import type { BrandColors } from "../config/colors.js";

/**
 * The colours an OG card paints with, all from the brand's roles. `surface` and `border` are the
 * foreground laid over the background at a low alpha, so tiles read on any brand.
 */
export interface OgPalette {
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  cta: string;
  onCta: string;
  /** Tile fill: the foreground at 8 % alpha. */
  surface: string;
  /** Tile outline: the foreground at 16 % alpha. */
  border: string;
}

export const SURFACE_ALPHA = 0x14;
export const BORDER_ALPHA = 0x29;

/** `#abc`, `#abcd`, `#aabbcc` or `#aabbccdd` → `#aabbcc` (lowercase, alpha dropped). */
export function toOpaqueHex(color: string): string {
  const digits = color.slice(1).toLowerCase();
  const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join("") : digits;
  return `#${full.slice(0, 6)}`;
}

/** `color` at `alpha` (0-255) as `#rrggbbaa`. */
export function withAlpha(color: string, alpha: number): string {
  return `${toOpaqueHex(color)}${alpha.toString(16).padStart(2, "0")}`;
}

export function getOgPalette(colors: BrandColors): OgPalette {
  return {
    background: colors.background,
    foreground: colors.foreground,
    muted: colors.muted,
    accent: colors.accent,
    cta: colors.cta,
    onCta: colors.onCta,
    surface: withAlpha(colors.foreground, SURFACE_ALPHA),
    border: withAlpha(colors.foreground, BORDER_ALPHA),
  };
}
