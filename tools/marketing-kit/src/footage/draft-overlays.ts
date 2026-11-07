import { toAssColor } from "./draft-color.js";
import type { OverlayColors } from "./overlay-html.js";
import { OVERLAY_PADDING_EM, type OverlayPoint, type ResolvedOverlay } from "./overlays.js";

/**
 * The draft's overlays as ASS (issue #1200): the same places and times as the render, simplified. Text overlays are
 * cards of the brand's background (libass's opaque box) with the text in its foreground; an arrow is a straight shaft
 * and head in the accent; a highlight the accent's outline round its rectangle. A `punch_in` is drawn by the picture's
 * zoom (`buildPictureFilters`), not here. They sit on layers 3 and up, over the captions' 0 to 2.
 */

/** An arrow's or a highlight's stroke and the arrow head's length, in px of a 1080 px wide frame (as the render). */
const STROKE_WIDTH = 10;
const ARROW_HEAD = 46;
const FADE = "\\fad(150,250)";

const r0 = (value: number): number => Math.round(value);

/** An ASS colour for an override tag (`&HBBGGRR&`). */
const toTagColor = (hex: string): string => `${toAssColor(hex).replace(/^&H../, "&H")}&`;

/** The two styles the overlays use: `Overlay` (text on an opaque card) and `OverlayShape` (drawings). */
export function getDraftOverlayStyles(family: string, colors: OverlayColors): string[] {
  const card = toAssColor(colors.background);
  const text = toAssColor(colors.foreground);
  const accent = toAssColor(colors.accent);
  return [
    `Style: Overlay,${family},48,${text},${text},${card},${card},-1,0,0,0,100,100,0,0,3,16,0,7,0,0,0,1`,
    `Style: OverlayShape,${family},48,${accent},${accent},${accent},${accent},0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1`,
  ];
}

/** An ASS time: `H:MM:SS.cc`. */
function toAssTime(seconds: number): string {
  const centiseconds = Math.max(0, Math.round(seconds * 100));
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${Math.floor(centiseconds / 360000)}:${pad(Math.floor((centiseconds % 360000) / 6000))}:${pad(Math.floor((centiseconds % 6000) / 100))}.${pad(centiseconds % 100)}`;
}

/** Overlay text as ASS dialogue: braces and backslashes would read as tags. */
function toAssText(text: string): string {
  return text.replace(/\\/g, "/").replace(/\{/g, "(").replace(/\}/g, ")").replace(/\s+/g, " ").trim();
}

/** A straight arrow from `from` to `to` as an ASS drawing: the shaft's quad and the head's triangle. */
export function getArrowDrawing(from: OverlayPoint, to: OverlayPoint, scale: number): string {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const u = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const n = { x: -u.y, y: u.x };
  const half = (STROKE_WIDTH * scale) / 2;
  const head = ARROW_HEAD * scale;
  const base = { x: to.x - u.x * head, y: to.y - u.y * head };
  const p = (x: number, y: number) => `${r0(x)} ${r0(y)}`;
  const shaft = `m ${p(from.x + n.x * half, from.y + n.y * half)} l ${p(base.x + n.x * half, base.y + n.y * half)} ${p(base.x - n.x * half, base.y - n.y * half)} ${p(from.x - n.x * half, from.y - n.y * half)}`;
  const wing = head * 0.6;
  const tip = `m ${p(to.x, to.y)} l ${p(base.x + n.x * wing, base.y + n.y * wing)} ${p(base.x - n.x * wing, base.y - n.y * wing)}`;
  return `${shaft} ${tip}`;
}

/** The overlays as ASS events, layer 3 and up. */
export function buildDraftOverlayEvents(overlays: readonly ResolvedOverlay[], colors: OverlayColors, frame: { width: number; height: number }): string[] {
  const scale = frame.width / 1080;
  const accent = toTagColor(colors.accent);
  return overlays.flatMap((overlay) => {
    const at = `${toAssTime(overlay.start)},${toAssTime(overlay.end)}`;
    if (overlay.kind === "punch_in") return [];
    if (overlay.kind === "arrow") {
      return [`Dialogue: 3,${at},OverlayShape,,0,0,0,,{\\an7\\pos(0,0)${FADE}\\p1}${getArrowDrawing(overlay.from, overlay.to, scale)}{\\p0}`];
    }
    if (overlay.kind === "highlight") {
      // libass grows a drawing's border outwards only: the shape is inset by half the stroke and bordered by all of
      // it, so the stroke straddles the rectangle's edge as the render's SVG stroke does.
      const stroke = r0(STROKE_WIDTH * scale);
      const half = stroke / 2;
      const [left, top] = [overlay.rect.left + half, overlay.rect.top + half];
      const [right, bottom] = [overlay.rect.left + overlay.rect.width - half, overlay.rect.top + overlay.rect.height - half];
      const shape = `m ${r0(left)} ${r0(top)} l ${r0(right)} ${r0(top)} ${r0(right)} ${r0(bottom)} ${r0(left)} ${r0(bottom)}`;
      return [`Dialogue: 3,${at},OverlayShape,,0,0,0,,{\\an7\\pos(0,0)${FADE}\\1a&HFF&\\3c${accent}\\bord${stroke}\\p1}${shape}{\\p0}`];
    }
    const { box, fontSize, side } = overlay;
    const pad = r0(fontSize * OVERLAY_PADDING_EM.y);
    const isRight = side === "right";
    const x = isRight ? box.left + box.width - pad : box.left + pad;
    const isFoot = overlay.kind === "lower_third";
    const y = isFoot ? box.top + box.height - pad : box.top + pad;
    // \an: 7 top left, 9 top right, 1 bottom left, 3 bottom right.
    const align = isFoot ? (isRight ? 3 : 1) : isRight ? 9 : 7;
    const text = overlay.kind === "list" ? overlay.items.map((item) => `• ${toAssText(item)}`).join("\\N") : toAssText(overlay.text);
    return [`Dialogue: 3,${at},Overlay,,0,0,0,,{\\an${align}\\pos(${r0(x)},${r0(y)})\\fs${fontSize}\\bord${pad}${FADE}}${text}`];
  });
}
