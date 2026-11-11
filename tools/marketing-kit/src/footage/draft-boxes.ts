import { STYLE_BORDER_PX, STYLE_SHADOW, type BrandStyle } from "./brand-style.js";
import { toAssColor } from "./draft-color.js";
import { getRoundedRectDrawing } from "./draft-overlays.js";

/**
 * A box of the brand's style in a footage draft (ASS): its soft shadow (a blurred, faint, lowered copy), the box itself
 * in its colour and opacity, and its thin border in the accent, as drawing events on one layer in that order (libass
 * draws later events of a layer over earlier ones). The caption pill and the overlay cards share it.
 */

export interface DraftBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DraftBoxEventsInput {
  layer: number;
  /** `H:MM:SS.cc,H:MM:SS.cc`. */
  at: string;
  /** The style the drawings use: BorderStyle 1, no outline, no shadow, `\an7`. */
  styleName: string;
  box: DraftBox;
  radius: number;
  /** The box's colour, `#rrggbb` or `#rrggbbaa`. */
  color: string;
  accent: string;
  style: Pick<BrandStyle, "shadow" | "border">;
  /** The frame's width / 1080. */
  scale: number;
  /** Motion tags every drawing takes (a fade, a move, a scale, a clip); a `\move` replaces the `\pos`. */
  motion?: string;
  /** A blur entrance or exit: the tags for a drawing whose own blur is `own` (the shadow's, else 0). */
  blurTags?: (own: number) => string;
}

/** An ASS colour and alpha as override tags of colour `slot` (1 fill, 3 border). */
function toColorTags(hex: string, slot: 1 | 3): string {
  const ass = toAssColor(hex);
  return `\\${String(slot)}c&H${ass.slice(4)}&\\${String(slot)}a&H${ass.slice(2, 4)}&`;
}

/** The shadow, box and border drawings of one box. */
export function getDraftBoxEvents(input: DraftBoxEventsInput): string[] {
  const { box, radius, scale } = input;
  const motion = input.motion ?? "";
  const pos = motion.includes("\\move") ? "" : "\\pos(0,0)";
  const drawing = getRoundedRectDrawing(box, radius);
  const event = (tags: string, shape: string, blur = 0) =>
    `Dialogue: ${String(input.layer)},${input.at},${input.styleName},,0,0,0,,{\\an7${pos}${motion}${tags}${input.blurTags?.(blur) ?? ""}\\p1}${shape}{\\p0}`;
  const events: string[] = [];
  if (input.style.shadow === "soft") {
    const lowered = getRoundedRectDrawing({ ...box, top: box.top + STYLE_SHADOW.offsetY * scale }, radius);
    const alpha = Math.round((1 - STYLE_SHADOW.opacity) * 255).toString(16).padStart(2, "0").toUpperCase();
    const blur = Math.round((STYLE_SHADOW.blur / 3) * scale);
    events.push(event(`\\1c&H000000&\\1a&H${alpha}&\\bord0\\shad0\\blur${String(blur)}`, lowered, blur));
  }
  events.push(event(`${toColorTags(input.color, 1)}\\bord0\\shad0`, drawing));
  if (input.style.border === "thin") {
    events.push(event(`\\1a&HFF&${toColorTags(input.accent, 3)}\\bord${String(Math.max(1, Math.round(STYLE_BORDER_PX * scale)))}\\shad0`, drawing));
  }
  return events;
}
