/**
 * The brand's one look for its boxes (`FootageBrand.style`): the corner radius, padding, shadow and border the draft
 * and the render draw the caption pill, every overlay card, the cover's pill and kicker box and the end card's call to
 * action with. A radius is in px of a 1080 px wide frame, not in font sizes, so one token gives the same corner on a
 * caption and on a keyword. Without a style every film draws as before it existed.
 */

export const CORNER_RADII = ["none", "s", "m", "l", "pill"] as const;
export type CornerRadius = (typeof CORNER_RADII)[number];

export const STYLE_PADDINGS = ["s", "m", "l"] as const;
export type StylePadding = (typeof STYLE_PADDINGS)[number];

export const STYLE_SHADOWS = ["none", "soft"] as const;
export type StyleShadow = (typeof STYLE_SHADOWS)[number];

export const STYLE_BORDERS = ["none", "thin"] as const;
export type StyleBorder = (typeof STYLE_BORDERS)[number];

export interface BrandStyle {
  /** Every box's corner: the caption pill and each overlay card unless they name their own. */
  cornerRadius: CornerRadius;
  /** The caption pill's padding around its text: `m` is the pill's 16 x 28 px. */
  padding: StylePadding;
  /** A soft shadow under each box (never a glow), or none. */
  shadow: StyleShadow;
  /** A thin line round each box in the brand's accent, or none. */
  border: StyleBorder;
  /** The caption pill's own corner, over `cornerRadius`. */
  captionCornerRadius?: CornerRadius;
}

/** The radius of each token, in px of a 1080 px wide frame; `pill` is half the box's height. */
export const CORNER_RADIUS_PX: Readonly<Record<Exclude<CornerRadius, "pill">, number>> = { none: 0, s: 12, m: 22, l: 36 };

/** How much each padding token grows or shrinks the pill's padding. */
export const STYLE_PADDING_SCALES: Readonly<Record<StylePadding, number>> = { s: 0.75, m: 1, l: 1.35 };

/** A thin border's width, in px of a 1080 px wide frame. */
export const STYLE_BORDER_PX = 3;

/** The soft shadow, in px of a 1080 px wide frame: down a little, wide and faint, as the render's cards had it. */
export const STYLE_SHADOW = { offsetY: 14, blur: 44, opacity: 0.4 } as const;

/** A token's radius in px for a box `height` px tall, at `scale` (the frame's width / 1080); never past half the height. */
export function getCornerRadiusPx(token: CornerRadius, height: number, scale = 1): number {
  const half = height / 2;
  if (token === "pill") return Math.round(half * 1000) / 1000;
  return Math.min(half, Math.round(CORNER_RADIUS_PX[token] * scale * 1000) / 1000);
}

/** The caption pill's corner: its own, else the style's. */
export function getCaptionCornerRadius(style: BrandStyle): CornerRadius {
  return style.captionCornerRadius ?? style.cornerRadius;
}

/** The pill's padding at a padding token, in px: `{ y, x }` scaled from `base`. */
export function getStylePadding(base: { y: number; x: number }, padding: StylePadding): { y: number; x: number } {
  const scale = STYLE_PADDING_SCALES[padding];
  return { y: Math.round(base.y * scale), x: Math.round(base.x * scale) };
}

/** The CSS `box-shadow` of a style at `scale`: the soft shadow, or `none`. */
export function getStyleShadowCss(style: Pick<BrandStyle, "shadow">, scale = 1): string {
  if (style.shadow === "none") return "none";
  return `0 ${String(Math.round(STYLE_SHADOW.offsetY * scale))}px ${String(Math.round(STYLE_SHADOW.blur * scale))}px rgba(0,0,0,${String(STYLE_SHADOW.opacity)})`;
}

/** The CSS `border` of a style in `accent` at `scale`, or `none`. */
export function getStyleBorderCss(style: Pick<BrandStyle, "border">, accent: string, scale = 1): string {
  return style.border === "none" ? "none" : `${String(Math.max(1, Math.round(STYLE_BORDER_PX * scale)))}px solid ${accent}`;
}

/** A radius as CSS: px of a 1080 px frame at `scale`, `pill` as 999 px (the browser keeps it to half the height). */
export function getCornerRadiusCss(token: CornerRadius, scale = 1): string {
  return token === "pill" ? "999px" : `${String(Math.round(CORNER_RADIUS_PX[token] * scale))}px`;
}
