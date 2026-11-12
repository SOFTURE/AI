import { getCornerRadiusPx, type BrandStyle, type CornerRadius } from "./brand-style.js";
import { getDraftBoxEvents } from "./draft-boxes.js";
import { toAssColor } from "./draft-color.js";
import { HAND_FONT, getHandFontAssSize } from "./hand-font.js";
import { getCounterSeconds, getOverlayColors, getPlaceCardTimes, getTypingTimes, type OverlayColors } from "./overlay-html.js";
import {
  DROP_LETTER_SECONDS,
  NOTE_GROW_FROM_SCALE,
  NOTE_GROW_SECONDS,
  NOTE_TICK_SECONDS,
  OVERLAY_EASES,
  getDropLetterTimes,
  PIN_DROP_SECONDS,
  PIN_DROP_SHARE,
  UNDERLINE_EM,
  UNDERLINE_SECONDS,
  getEntranceMotion,
  getExitMotion,
  getWipeHalves,
  type OverlayEntranceMotion,
  type OverlayExitMotion,
} from "./overlay-motion.js";
import type { OverlayEntrance } from "./overlay-schema.js";
import {
  NOTE_LINE_HEIGHT,
  OVERLAY_FONT_ROLES,
  OVERLAY_LINE_HEIGHT,
  OVERLAY_LIST_LINE_HEIGHT,
  OVERLAY_TITLE_LINE_HEIGHT,
  SEARCH_BAR_ICON_EM,
  SEARCH_BAR_PADDING_EM,
  estimateTextWidth,
  formatOverlayNumber,
  getDrawnOverlayCard,
  getListCardsByItem,
  getListItemTimes,
  getNoteCentre,
  getNoteColors,
  getNotePaperPoints,
  getNoteTextBox,
  getNoteTickPoints,
  getNoteWordsByLine,
  getOverlayPadding,
  getPlaceCardPinRow,
  getPlaceCardPinSize,
  getSideTextLines,
  getTitleContentBox,
  type OverlayBox,
  type OverlayFontRole,
  type OverlayPoint,
  type ResolvedOverlay,
} from "./overlays.js";

/**
 * The draft's overlays as ASS (issue #1200): the same places and times as the render, simplified. Text overlays are
 * drawn rounded cards of the brand's background, fitted to their text, with the text in its foreground; an
 * arrow is a straight shaft and head in the accent; a highlight the accent's outline round its rectangle; a pin and a
 * magnifier are drawings in the accent. A typed text shows letter by letter (the rest transparent, so its card keeps
 * its size), a counter steps up to its value every tenth of a second, a slide moves up into place. A `punch_in` is drawn
 * by the picture's zoom (`buildPictureFilters`), not here. They sit on layers 3 and 4, over the captions' 0 to 2.
 */

/** An arrow's or a highlight's stroke and the arrow head's length, in px of a 1080 px wide frame (as the render). */
const STROKE_WIDTH = 10;
const ARROW_HEAD = 46;
const FADE_IN_MS = 150;
const FADE_OUT_MS = 250;
const FADE = `\\fad(${FADE_IN_MS},${FADE_OUT_MS})`;
/** How far a slide starts below its place, in px of a 1080 px wide frame, and how long it takes. */
const SLIDE_PX = 28;
const SLIDE_MS = 300;
/** A counter's step in the draft, in seconds. */
const COUNT_STEP = 0.1;
/** A transparent primary colour: the typed text not shown yet. */
const HIDDEN = "{\\1a&HFF&}";

const r0 = (value: number): number => Math.round(value);

/** An ASS colour for an override tag (`&HBBGGRR&`). */
const toTagColor = (hex: string): string => `${toAssColor(hex).replace(/^&H../, "&H")}&`;

/** The two styles the overlays use: `OverlayShape` (drawings: cards, marks, pins) and `OverlayPlain` (text over them). */
export function getDraftOverlayStyles(family: string, colors: OverlayColors): string[] {
  const text = toAssColor(colors.foreground);
  const accent = toAssColor(colors.accent);
  return [
    `Style: OverlayShape,${family},48,${accent},${accent},${accent},${accent},0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1`,
    `Style: OverlayPlain,${family},48,${text},${text},${text},${text},-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1`,
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

/** A rounded rectangle as an ASS drawing: straight sides and quarter-circle corners of radius `radius` (bezier). */
export function getRoundedRectDrawing(box: { left: number; top: number; width: number; height: number }, radius: number): string {
  const r = Math.min(radius, box.width / 2, box.height / 2);
  const k = r * 0.4477; // 1 - 0.5523, the bezier handle of a quarter circle
  const [x0, y0, x1, y1] = [box.left, box.top, box.left + box.width, box.top + box.height];
  const p = (x: number, y: number) => `${r0(x)} ${r0(y)}`;
  return [
    `m ${p(x0 + r, y0)} l ${p(x1 - r, y0)}`,
    `b ${p(x1 - k, y0)} ${p(x1, y0 + k)} ${p(x1, y0 + r)} l ${p(x1, y1 - r)}`,
    `b ${p(x1, y1 - k)} ${p(x1 - k, y1)} ${p(x1 - r, y1)} l ${p(x0 + r, y1)}`,
    `b ${p(x0 + k, y1)} ${p(x0, y1 - k)} ${p(x0, y1 - r)} l ${p(x0, y0 + r)}`,
    `b ${p(x0, y0 + k)} ${p(x0 + k, y0)} ${p(x0 + r, y0)}`,
  ].join(" ");
}

/** A circle as an ASS drawing (four bezier quarters), clockwise, or the other way round to cut a hole. */
function getCircleDrawing(center: OverlayPoint, radius: number, isReversed = false): string {
  const k = radius * 0.5523;
  const p = (x: number, y: number) => `${r0(center.x + x)} ${r0(center.y + y)}`;
  const turn = isReversed ? -1 : 1;
  return `m ${p(0, -radius)} b ${p(turn * k, -radius)} ${p(turn * radius, -k)} ${p(turn * radius, 0)} b ${p(turn * radius, k)} ${p(turn * k, radius)} ${p(0, radius)} b ${p(-turn * k, radius)} ${p(-turn * radius, k)} ${p(-turn * radius, 0)} b ${p(-turn * radius, -k)} ${p(-turn * k, -radius)} ${p(0, -radius)}`;
}

/** A map pin `size` px tall with its top left at `at`: a drop, its hole cut by drawing it the other way round. */
export function getPinDrawing(at: OverlayPoint, size: number): string {
  const s = size / 24;
  const p = (x: number, y: number) => `${r0(at.x + x * s)} ${r0(at.y + y * s)}`;
  const drop = `m ${p(12, 22.5)} b ${p(9, 19)} ${p(4.25, 13.5)} ${p(4.25, 9.1)} b ${p(4.25, 4.9)} ${p(7.7, 1.5)} ${p(12, 1.5)} b ${p(16.3, 1.5)} ${p(19.75, 4.9)} ${p(19.75, 9.1)} b ${p(19.75, 13.5)} ${p(15, 19)} ${p(12, 22.5)}`;
  const hole = `m ${p(12, 6.1)} b ${p(10.3, 6.1)} ${p(9, 7.4)} ${p(9, 9.1)} b ${p(9, 10.8)} ${p(10.3, 12.1)} ${p(12, 12.1)} b ${p(13.7, 12.1)} ${p(15, 10.8)} ${p(15, 9.1)} b ${p(15, 7.4)} ${p(13.7, 6.1)} ${p(12, 6.1)}`;
  return `${drop} ${hole}`;
}

/** A magnifier `size` px wide with its top left at `at`: a ring and a handle. */
export function getGlassDrawing(at: OverlayPoint, size: number): string {
  const s = size / 24;
  const center = { x: at.x + 10 * s, y: at.y + 10 * s };
  const ring = `${getCircleDrawing(center, 7.9 * s)} ${getCircleDrawing(center, 5.3 * s, true)}`;
  const half = 1.3 * s;
  const p = (x: number, y: number) => `${r0(at.x + x * s)} ${r0(at.y + y * s)}`;
  const handle = `m ${p(15 - half, 15 + half)} l ${p(15 + half, 15 - half)} ${p(21 + half, 21 - half)} ${p(21 - half, 21 + half)}`;
  return `${ring} ${handle}`;
}

interface DraftContext {
  brand: OverlayColors;
  scale: number;
  locale: string;
  /** The font family per role, when it is not the styles' own. */
  fonts: Partial<Record<OverlayFontRole, string>>;
  /** The brand's style: the cards' radius, shadow and border; absent: each kind's own corner, no shadow, no border. */
  style?: BrandStyle;
}

/**
 * A card's corner in px: its own token, else the brand style's (a search bar stays a pill unless it names its own),
 * else `own` (the kind's look before the style).
 */
export function getDraftCardRadius(overlay: { kind: string; cornerRadius?: CornerRadius | null }, box: { height: number }, context: Pick<DraftContext, "style" | "scale">, own: number): number {
  const token = overlay.cornerRadius ?? (context.style === undefined ? null : overlay.kind === "search_bar" ? "pill" : context.style.cornerRadius);
  return token === null ? own : getCornerRadiusPx(token, box.height, context.scale);
}

/** One stretch of an overlay's text: what shows from `from` to `to`, and its tags. */
interface TextStep {
  from: number;
  to: number;
  text: string;
}

/** How one overlay moves in the draft: its entrance and exit (`overlay-motion.ts`) and the card they scale about and wipe over. */
interface DraftMotion {
  /** The entrance it shows (the kind's own already chosen when the overlay names none). */
  name: OverlayEntrance;
  entrance: OverlayEntranceMotion;
  exit: OverlayExitMotion;
  /** The card a pop scales about and a wipe reveals. */
  card: OverlayBox;
  /** The frame's width / 1080. */
  scale: number;
  isSnappy: boolean;
  /** Whether the card's entrance moves it (slide, rise, pop): then no part moves on the way out, so they stay together. */
  isCardMoved: boolean;
}

/** An overlay's draft motion with its entrance `name` (already the kind's own when it names none). */
function getDraftMotion(overlay: Exclude<ResolvedOverlay, { kind: "punch_in" }>, name: OverlayEntrance, card: OverlayBox, context: DraftContext): DraftMotion {
  const easing = overlay.easing ?? "smooth";
  const frame = { width: 1080 * context.scale, height: 1920 * context.scale };
  return {
    name,
    entrance: getEntranceMotion(name, easing, frame),
    exit: getExitMotion({ exit: overlay.exit ?? "auto", entrance: overlay.entrance, easing, frame }),
    card,
    scale: context.scale,
    isSnappy: easing === "snappy",
    isCardMoved: name === "slide" || name === "rise" || name === "pop",
  };
}

/** The same motion entering by a plain fade: a part that comes in after its card (a delayed subtitle, a staggered point). */
function withFadeEntrance(motion: DraftMotion): DraftMotion {
  return { ...motion, name: "fade", entrance: getEntranceMotion("fade", "smooth", { width: 1080, height: 1920 }) };
}

/** Which part of an overlay an event draws: its card (and drawings on it), its text, or a wipe's accent panel. */
type DraftPart = "card" | "text";

/** The rectangle a wipe clips to, round the card with room for its shadow and border. */
function getWipeClip(motion: DraftMotion): { x0: number; y0: number; x1: number; y1: number } {
  const room = 24 * motion.scale;
  const { card } = motion;
  return { x0: r0(card.left - room / 4), y0: r0(card.top - room), x1: r0(card.left + card.width + room / 4), y1: r0(card.top + card.height + room) };
}

const toClip = (box: { x0: number; y0: number; x1: number; y1: number }): string => `\\clip(${box.x0},${box.y0},${box.x1},${box.y1})`;
const toMs = (seconds: number): number => Math.max(0, Math.round(seconds * 1000));

/**
 * The position and motion tags of one event of a run: the first takes the entrance (a fade, a slide or a rise moving up
 * into place, a pop growing about the card's middle, a wipe's clip), the last the exit (a fade, a move down, a wipe
 * off to the right). libass scales about an event's position, so a pop moves the position with the scale (both linear)
 * to keep the card's middle still. `pos` is the event's position, (0, 0) for a drawing.
 */
function getMotionTags(motion: DraftMotion, input: { isFirst: boolean; isLast: boolean; pos: OverlayPoint; ms: number; part: DraftPart }): { position: string; rest: string } {
  const { entrance, exit } = motion;
  const { pos, ms } = input;
  let move: string | null = null;
  const tags: string[] = [];
  let fadeIn = 0;
  if (input.isFirst && entrance.kind === "tween") {
    const enterMs = toMs(entrance.seconds);
    fadeIn = motion.name === "fade" || motion.name === "slide" || motion.name === "type" ? FADE_IN_MS : r0(enterMs * 0.7);
    if (motion.name === "slide") move = `\\move(${r0(pos.x)},${r0(pos.y + SLIDE_PX * motion.scale)},${r0(pos.x)},${r0(pos.y)},0,${SLIDE_MS})`;
    if (entrance.from.y > 0 && motion.name !== "slide") move = `\\move(${r0(pos.x)},${r0(pos.y + entrance.from.y)},${r0(pos.x)},${r0(pos.y)},0,${enterMs})`;
    if (entrance.from.scale < 1) {
      const s = entrance.from.scale;
      const centre = { x: motion.card.left + motion.card.width / 2, y: motion.card.top + motion.card.height / 2 };
      move = `\\move(${r0(centre.x + s * (pos.x - centre.x))},${r0(centre.y + s * (pos.y - centre.y))},${r0(pos.x)},${r0(pos.y)},0,${enterMs})`;
      const percent = Math.round(s * 100);
      tags.push(`\\fscx${percent}\\fscy${percent}\\t(0,${enterMs},\\fscx100\\fscy100)`);
    }
  }
  const clip = getWipeClip(motion);
  if (input.isFirst && entrance.kind === "wipe") {
    const halves = getWipeHalves(entrance.seconds);
    const [grow, reveal] = [toMs(halves.grow), toMs(halves.reveal)];
    const closed = toClip({ ...clip, x1: clip.x0 });
    tags.push(input.part === "card" ? `${closed}\\t(0,${grow},${toClip(clip)})` : `${closed}\\t(${grow},${grow + reveal},${toClip(clip)})`);
  }
  let fadeOut = 0;
  if (input.isLast && exit.kind !== "none") {
    if (exit.kind === "wipe") {
      const exitMs = toMs(exit.seconds);
      if (!(input.isFirst && entrance.kind === "wipe")) tags.push(toClip(clip));
      tags.push(`\\t(${Math.max(0, ms - exitMs)},${ms},${toClip({ ...clip, x0: clip.x1 })})`);
    } else {
      fadeOut = motion.isSnappy ? r0(FADE_OUT_MS * 0.7) : FADE_OUT_MS;
      if (exit.kind === "tween" && exit.from.y > 0 && !motion.isCardMoved) {
        const exitMs = toMs(exit.seconds);
        move = `\\move(${r0(pos.x)},${r0(pos.y)},${r0(pos.x)},${r0(pos.y + exit.from.y)},${Math.max(0, ms - exitMs)},${ms})`;
      }
    }
  }
  const fade = fadeIn === 0 && fadeOut === 0 ? "" : `\\fad(${fadeIn},${fadeOut})`;
  return { position: move ?? `\\pos(${r0(pos.x)},${r0(pos.y)})`, rest: `${fade}${tags.join("")}` };
}

/** A blur entrance's and exit's tags for an event whose own blur is `own`: from blurred to its own, from its own to blurred. */
function getBlurTags(motion: DraftMotion, input: { isFirst: boolean; isLast: boolean; ms: number }, own: number): string {
  const tags: string[] = [];
  if (input.isFirst && motion.entrance.kind === "tween" && motion.entrance.from.blur > 0) {
    tags.push(`\\blur${Math.max(own, r0(motion.entrance.from.blur / 2))}\\t(0,${toMs(motion.entrance.seconds)},\\blur${own})`);
  }
  if (input.isLast && motion.exit.kind === "tween" && motion.exit.from.blur > 0) {
    const exitMs = toMs(motion.exit.seconds);
    tags.push(`\\t(${Math.max(0, input.ms - exitMs)},${input.ms},\\blur${Math.max(own, r0(motion.exit.from.blur / 2))})`);
  }
  return tags.join("");
}

/** Text events for a run of steps, positioned at `pos` with `tags`, the entrance on the first and the exit on the last. */
function getTextEvents(input: { layer: number; style: string; pos: OverlayPoint; tags: string; steps: TextStep[]; motion: DraftMotion }): string[] {
  return input.steps.map((step, index) => {
    const at = { isFirst: index === 0, isLast: index === input.steps.length - 1, ms: toMs(step.to - step.from) };
    const { position, rest } = getMotionTags(input.motion, { ...at, pos: input.pos, part: "text" });
    return `Dialogue: ${input.layer},${toAssTime(step.from)},${toAssTime(step.to)},${input.style},,0,0,0,,{${input.tags}${position}${rest}${getBlurTags(input.motion, at, 0)}}${step.text}`;
  });
}

/**
 * The steps of a text that types in letter by letter, or one step showing it all. Text anchored at its start (left or
 * right aligned) keeps the rest transparent so it types in place; centred text (`isCentred`) shows only what is typed,
 * so the typed part stays centred in its card while the card keeps the whole text's width (RV-131 of an adopting app:
 * the typed start sat left of an empty card).
 */
function getTypedSteps(text: string, span: { start: number; end: number }, typing: number | null, isCentred = false): TextStep[] {
  const clean = toAssText(text);
  if (typing === null || clean.length === 0) return [{ from: span.start, to: span.end, text: clean }];
  const chars = [...clean];
  const times = getTypingTimes(span.start, clean, typing).map((time) => Math.min(time, span.end));
  const steps: TextStep[] = isCentred ? [] : [{ from: span.start, to: times[0] as number, text: `${HIDDEN}${clean}` }];
  times.forEach((time, index) => {
    const shown = chars.slice(0, index + 1).join("");
    const rest = chars.slice(index + 1).join("");
    steps.push({ from: time, to: times[index + 1] ?? span.end, text: rest.length === 0 || isCentred ? shown.trimEnd() : `${shown}${HIDDEN}${rest}` });
  });
  return steps.filter((step) => step.to > step.from && step.text.length > 0);
}

/** The colour and font override tags of an overlay's text: only what differs from the style. */
function getTextTags(overlay: ResolvedOverlay, colors: OverlayColors, context: DraftContext, role: OverlayFontRole): string {
  if (overlay.kind === "punch_in") return "";
  const own = overlay.colors;
  const font = context.fonts[role];
  return [
    font === undefined ? "" : `\\fn${font}`,
    own.text === undefined ? "" : `\\1c${toTagColor(colors.foreground)}`,
  ].join("");
}

/** A card's own corner without a brand style: the render's `.ov-card` (0.42 em), a search bar's full pill. */
function getOwnCardRadius(overlay: Pick<ResolvedOverlay, "kind">, box: { height: number }, fontSize: number): number {
  return overlay.kind === "search_bar" ? box.height / 2 : fontSize * 0.42;
}

/**
 * A card's drawn box on layer 3 with the overlay's motion: one fill without a brand style, else the style's shadow,
 * fill and border (`getDraftBoxEvents`), at the brand style's corner or the overlay's own (`getDraftCardRadius`); a
 * wipe's accent panel over it.
 */
function getCardShapeEvents(
  overlay: Exclude<ResolvedOverlay, { kind: "punch_in" }>,
  box: OverlayBox,
  fontSize: number,
  colors: { background: string; accent: string },
  motion: DraftMotion,
  context: DraftContext,
  span: ShapeSpan = { start: overlay.start, end: overlay.end, isFirst: true, isLast: true },
): string[] {
  const radius = getDraftCardRadius(overlay, box, context, getOwnCardRadius(overlay, box, fontSize));
  const drawing = getRoundedRectDrawing(box, radius);
  const panel = span.isFirst ? getWipePanelEvent(span, drawing, colors.accent, motion) : [];
  if (context.style === undefined) return [getShapeEvent(span, drawing, colors.background, motion, 3, span), ...panel];
  const at = { isFirst: span.isFirst, isLast: span.isLast, ms: toMs(span.end - span.start) };
  const { position, rest } = getMotionTags(motion, { ...at, pos: { x: 0, y: 0 }, part: "card" });
  const events = getDraftBoxEvents({
    layer: 3,
    at: `${toAssTime(span.start)},${toAssTime(span.end)}`,
    styleName: "OverlayShape",
    box,
    radius,
    color: colors.background,
    accent: colors.accent,
    style: context.style,
    scale: context.scale,
    motion: `${position.startsWith("\\move") ? position : ""}${rest}`,
    blurTags: (own) => getBlurTags(motion, at, own),
  });
  return [...events, ...panel];
}

/** A wipe's accent panel: it grows over the card from the left, then slides off to the right, revealing the card and its text. */
function getWipePanelEvent(overlay: Pick<ResolvedOverlay, "start">, drawing: string, accent: string, motion: DraftMotion): string[] {
  if (motion.entrance.kind !== "wipe") return [];
  const halves = getWipeHalves(motion.entrance.seconds);
  const [grow, reveal] = [toMs(halves.grow), toMs(halves.reveal)];
  const clip = getWipeClip(motion);
  const tags = `${toClip({ ...clip, x1: clip.x0 })}\\t(0,${grow},${toClip(clip)})\\t(${grow},${grow + reveal},${toClip({ ...clip, x0: clip.x1 })})`;
  return [`Dialogue: 3,${toAssTime(overlay.start)},${toAssTime(overlay.start + motion.entrance.seconds)},OverlayShape,,0,0,0,,{\\an7\\pos(0,0)${tags}\\1c${toTagColor(accent)}\\p1}${drawing}{\\p0}`];
}

/** The same motion with no entrance of its own: a part whose letters or words come in by themselves. */
function getPlainMotion(motion: DraftMotion): DraftMotion {
  return { ...motion, name: "none", entrance: { kind: "none" } };
}

/**
 * A dropped text as one line of ASS: each letter transparent until its second (`times`, from `getDropLetterTimes`),
 * then fading in over half a fall. libass moves whole events only, so the draft shows the letters arriving on their
 * times without the fall the render draws.
 */
export function getDropText(text: string, times: readonly number[], eventStart: number): string {
  const fade = toMs(DROP_LETTER_SECONDS / 2);
  return [...toAssText(text)]
    .map((char, index) => {
      if (char.trim() === "") return char;
      const from = toMs((times[index] ?? eventStart) - eventStart);
      return `{\\alpha&HFF&\\t(${from},${from + fade},\\alpha&H00&)}${char}`;
    })
    .join("");
}

/** A highlight mark's padding round its text and its corner, in font sizes (as the render's `.ov-mark`). */
const MARK_PADDING_EM = { x: 0.22, y: 0.04 } as const;
const MARK_RADIUS_EM = 0.14;

/**
 * A highlight backdrop's marks under one line of text (`style.backdrop` highlight): a tight rounded box in the card
 * colour, its width the text shown so far (each typed letter widens it, as the render's box grows), anchored where
 * the text is (`x` its left, middle or right edge, `top` its top).
 */
function getBackdropMarkEvents(input: {
  text: string;
  x: number;
  align: "left" | "center" | "right";
  top: number;
  fontSize: number;
  colour: string;
  motion: DraftMotion;
  span: { start: number; end: number };
  typing: number | null;
  /** When the line starts typing, if not at the span's start (a second line of a title). */
  typeFrom?: number;
}): string[] {
  const { fontSize, span } = input;
  const pad = { x: fontSize * MARK_PADDING_EM.x, y: fontSize * MARK_PADDING_EM.y };
  const height = fontSize * OVERLAY_LINE_HEIGHT + 2 * pad.y;
  const boxFor = (shown: string): OverlayBox => {
    const width = estimateTextWidth(shown, fontSize) + 2 * pad.x;
    const left = input.align === "left" ? input.x - pad.x : input.align === "right" ? input.x + pad.x - width : input.x - width / 2;
    return { left, top: input.top - pad.y, width, height };
  };
  const clean = toAssText(input.text);
  const steps =
    input.typing === null
      ? [{ from: span.start, to: span.end, shown: clean }]
      : getTypingTimes(input.typeFrom ?? span.start, clean, input.typing).map((at, index, times) => ({ from: Math.min(at, span.end), to: Math.min(times[index + 1] ?? span.end, span.end), shown: [...clean].slice(0, index + 1).join("").trimEnd() }));
  const visible = steps.filter((step) => step.to > step.from && step.shown.length > 0);
  return visible.map((step, index) =>
    getShapeEvent({ start: step.from, end: step.to }, getRoundedRectDrawing(boxFor(step.shown), fontSize * MARK_RADIUS_EM), input.colour, input.motion, 3, {
      start: step.from,
      end: step.to,
      isFirst: index === 0,
      isLast: index === visible.length - 1,
    }),
  );
}

/** A keyword's underline: an accent bar under its text, drawn from the left once the keyword is in. */
function getUnderlineEvent(overlay: Extract<ResolvedOverlay, { kind: "keyword" }>, card: OverlayBox, colour: string, motion: DraftMotion): string[] {
  if (overlay.underline !== true) return [];
  const pad = getOverlayPadding(overlay);
  const height = Math.max(2, r0(overlay.fontSize * UNDERLINE_EM.height));
  const bar = { left: card.left + pad.x, top: card.top + card.height - pad.y + r0(overlay.fontSize * UNDERLINE_EM.gap), width: card.width - 2 * pad.x, height };
  const after = motion.entrance.kind === "none" ? 0 : motion.entrance.seconds;
  const from = Math.min(overlay.end, overlay.start + after);
  const drawMs = toMs(UNDERLINE_SECONDS);
  const x0 = r0(bar.left);
  const clip = `\\clip(${x0},${r0(bar.top - 4)},${x0},${r0(bar.top + bar.height + 4)})\\t(0,${drawMs},\\clip(${x0},${r0(bar.top - 4)},${r0(bar.left + bar.width)},${r0(bar.top + bar.height + 4)}))`;
  const fade = motion.exit.kind === "none" ? "" : `\\fad(0,${motion.isSnappy ? r0(FADE_OUT_MS * 0.7) : FADE_OUT_MS})`;
  // Under a wipe off, the bar leaves as the wipe starts: it is not clipped with the card.
  const until = motion.exit.kind === "wipe" ? Math.max(from, overlay.end - motion.exit.seconds) : overlay.end;
  return [`Dialogue: 4,${toAssTime(from)},${toAssTime(until)},OverlayShape,,0,0,0,,{\\an7\\pos(0,0)${fade}${clip}\\1c${toTagColor(colour)}\\p1}${getRoundedRectDrawing(bar, height / 2)}{\\p0}`];
}

/**
 * A keyword, a lower third or a list: a drawn rounded card fitted to its text (`getDrawnOverlayCard`) on layer 3 and
 * its text on layer 4, inset by the card's padding on its side (a lower third from its foot). A staggered list's points
 * come in one by one; a keyword's underline is drawn once it is in.
 */
function getSideTextEvents(overlay: Extract<ResolvedOverlay, { kind: "keyword" | "lower_third" | "list" }>, context: DraftContext): string[] {
  if (overlay.kind === "list") return getListEvents(overlay, context);
  const colors = getOverlayColors(overlay, context.brand);
  const { fontSize, side } = overlay;
  // A side text always has a card: only a punch_in has none.
  const card = getDrawnOverlayCard(overlay) as OverlayBox;
  const { x: padX, y: padY } = getOverlayPadding(overlay);
  const isCentred = overlay.kind === "keyword" && overlay.isCentred === true;
  const isRight = !isCentred && side === "right";
  const x = isCentred ? card.left + card.width / 2 : isRight ? card.left + card.width - padX : card.left + padX;
  const isFoot = overlay.kind === "lower_third";
  const y = isFoot ? card.top + card.height - padY : card.top + padY;
  // \an: 7 top left, 8 top centre, 9 top right, 1 bottom left, 3 bottom right.
  const align = isFoot ? (isRight ? 3 : 1) : isCentred ? 8 : isRight ? 9 : 7;
  const motion = getDraftMotion(overlay, overlay.entrance === null || overlay.entrance === "type" ? "fade" : overlay.entrance, card, context);
  const span = { start: overlay.start, end: overlay.end };
  const tags = `\\an${align}\\fs${fontSize}${getTextTags(overlay, colors, context, OVERLAY_FONT_ROLES[overlay.kind])}`;
  const text = (pos: OverlayPoint, steps: TextStep[], own = motion) => getTextEvents({ layer: 4, style: "OverlayPlain", pos, tags, steps, motion: own });
  const isMarked = overlay.kind === "keyword" && overlay.backdrop === "highlight";
  const shape = isMarked
    ? getBackdropMarkEvents({ text: overlay.text, x, align: isCentred ? "center" : isRight ? "right" : "left", top: y, fontSize, colour: colors.background, motion, span, typing: overlay.typing })
    : getCardShapeEvents(overlay, card, fontSize, colors, motion, context);
  if (overlay.entrance === "drop") return [...shape, ...text({ x, y }, [{ from: span.start, to: span.end, text: getDropText(overlay.text, getDropLetterTimes(span.start, overlay.text), span.start) }], getPlainMotion(motion))];
  // A keyword or a lower third types in only when its entrance says so.
  const steps = overlay.entrance === null ? [{ from: span.start, to: span.end, text: toAssText(overlay.text) }] : getTypedSteps(overlay.text, span, overlay.typing, isCentred);
  return [...shape, ...text({ x, y }, steps), ...(overlay.kind === "keyword" ? getUnderlineEvent(overlay, card, colors.accent, motion) : [])];
}

/** A list's card grows to its next point's size over these seconds, in this many steps along the render's ease. */
const LIST_GROW_SECONDS = 0.35;
const LIST_GROW_STEPS = 3;

/** A clip from a card to the next card it grows to, eased out over the growth (an ASS `\\t` with its acceleration under 1). */
function getGrowClip(from: OverlayBox, to: OverlayBox): string {
  const rect = (box: OverlayBox) => toClip({ x0: r0(box.left), y0: r0(box.top), x1: r0(box.left + box.width), y1: r0(box.top + box.height) });
  return `${rect(from)}\\t(0,${toMs(LIST_GROW_SECONDS)},0.4,${rect(to)})`;
}

/** A box part of the way (`share`, 0 to 1) from `from` to `to`, in whole px. */
function getBoxBetween(from: OverlayBox, to: OverlayBox, share: number): OverlayBox {
  const at = (a: number, b: number) => r0(a + (b - a) * share);
  return { left: at(from.left, to.left), top: at(from.top, to.top), width: at(from.width, to.width), height: at(from.height, to.height) };
}

/**
 * A list's card shapes over time: one card per distinct second its points come in, each easing from the last one's size
 * in `LIST_GROW_STEPS` steps along the render's `power3.out`; the first takes the entrance, the last the exit.
 */
function getStackShapeEvents(overlay: Extract<ResolvedOverlay, { kind: "list" }>, times: readonly number[], colors: OverlayColors, context: DraftContext): string[] {
  const cards = getListCardsByItem(overlay).map((boxes) => boxes[0] as OverlayBox);
  // The card shown from each distinct second: the one fitted to every point in by then.
  const stops = times.flatMap((at, index) => (times[index + 1] === at ? [] : [{ at, card: cards[index] as OverlayBox }]));
  const name = overlay.entrance === null || overlay.entrance === "type" ? "fade" : overlay.entrance;
  const parts = stops.flatMap((stop, index) => {
    const previous = stops[index - 1];
    if (previous === undefined) return [{ start: stop.at, card: stop.card }];
    return Array.from({ length: LIST_GROW_STEPS }, (_step, step) => {
      const share = (step + 1) / LIST_GROW_STEPS;
      return { start: stop.at + (step * LIST_GROW_SECONDS) / LIST_GROW_STEPS, card: step === LIST_GROW_STEPS - 1 ? stop.card : getBoxBetween(previous.card, stop.card, OVERLAY_EASES["power3.out"](share)) };
    });
  });
  const visible = parts.filter((part, index) => part.start < overlay.end && (parts[index + 1]?.start ?? overlay.end) > part.start);
  return visible.flatMap((part, index) => {
    const end = Math.min(overlay.end, visible[index + 1]?.start ?? overlay.end);
    const motion = getDraftMotion(overlay, name, index === 0 ? part.card : (cards[cards.length - 1] as OverlayBox), context);
    return getCardShapeEvents(overlay, part.card, overlay.fontSize, colors, motion, context, { start: part.start, end, isFirst: index === 0, isLast: index === visible.length - 1 });
  });
}

/**
 * A list (RV-144 of an adopting app): a stack, its card coming in with its first point and growing to each next one,
 * its lines centred in the card (a centred stack) or from its side with their bullets; or chips, one card per point in
 * its final place, each entering on its own second. A point after the first fades in from its second.
 */
function getListEvents(overlay: Extract<ResolvedOverlay, { kind: "list" }>, context: DraftContext): string[] {
  const colors = getOverlayColors(overlay, context.brand);
  const { fontSize } = overlay;
  const pad = getOverlayPadding(overlay);
  const times = getListItemTimes(overlay);
  const name = overlay.entrance === null || overlay.entrance === "type" ? "fade" : overlay.entrance;
  const textTags = getTextTags(overlay, colors, context, OVERLAY_FONT_ROLES.list);
  const lines = getSideTextLines(overlay);
  const write = (pos: OverlayPoint, align: number, steps: TextStep[], motion: DraftMotion, clip = "") =>
    getTextEvents({ layer: 4, style: "OverlayPlain", pos, tags: `\\an${align}\\fs${fontSize}${textTags}${clip}`, steps, motion });
  if (overlay.chips !== undefined) {
    return overlay.chips.flatMap((chip, index) => {
      const from = times[index] as number;
      const motion = getDraftMotion(overlay, name, chip, context);
      const span = { start: from, end: overlay.end, isFirst: true, isLast: true };
      const pos = { x: chip.left + chip.width / 2, y: chip.top + pad.y };
      return [...getCardShapeEvents(overlay, chip, fontSize, colors, motion, context, span), ...write(pos, 8, [{ from, to: overlay.end, text: toAssText(lines[index] as string) }], motion)];
    });
  }
  // The text sits on the whole list's card: centred on its axis, or from its side.
  const card = getDrawnOverlayCard(overlay) as OverlayBox;
  const isCentred = overlay.isCentred === true;
  const isRight = !isCentred && overlay.side === "right";
  const x = isCentred ? card.left + card.width / 2 : isRight ? card.left + card.width - pad.x : card.left + pad.x;
  const align = isCentred ? 8 : isRight ? 9 : 7;
  // One event per point, on the render's line height (libass's own line spacing is tighter).
  const step = fontSize * OVERLAY_LIST_LINE_HEIGHT;
  const lead = (step - fontSize * OVERLAY_LINE_HEIGHT) / 2;
  const motion = getDraftMotion(overlay, name, card, context);
  const cards = getListCardsByItem(overlay).map((boxes) => boxes[0] as OverlayBox);
  return [
    ...getStackShapeEvents(overlay, times, colors, context),
    ...lines.flatMap((line, index) => {
      const from = times[index] as number;
      const pos = { x, y: card.top + pad.y + lead + index * step };
      if (from <= overlay.start) return write(pos, align, [{ from, to: overlay.end, text: toAssText(line) }], motion);
      // A later point shows only inside its card as the card grows to it, as the render's card clips it (a wipe's exit clips on its own).
      const previous = cards[times.findIndex((at) => at === from) - 1] as OverlayBox;
      const clip = motion.exit.kind === "wipe" ? "" : getGrowClip(previous, cards[index] as OverlayBox);
      return write(pos, align, [{ from, to: overlay.end, text: toAssText(line) }], withFadeEntrance(motion), clip);
    }),
  ];
}

type CardOverlay = Extract<ResolvedOverlay, { kind: "hook_title" | "search_bar" | "place_card" | "counter" | "date_stamp" }>;

/** Each card's own entrance when the overlay names none (a typed card fades its card in). */
const DEFAULT_ENTRANCES = { hook_title: "slide", search_bar: "fade", place_card: "slide", counter: "fade", date_stamp: "fade" } as const;

/** The stretch one drawn card shows for: its seconds, and whether it takes the entrance (first) and the exit (last). */
interface ShapeSpan {
  start: number;
  end: number;
  isFirst: boolean;
  isLast: boolean;
}

/** A drawing event in the overlay's card colour (or accent), with the overlay's motion (or a part of it, `span`). */
function getShapeEvent(overlay: Pick<ResolvedOverlay, "start" | "end">, drawing: string, colour: string, motion: DraftMotion, layer = 3, span?: ShapeSpan): string {
  const at = { isFirst: span?.isFirst ?? true, isLast: span?.isLast ?? true, ms: toMs(overlay.end - overlay.start) };
  const { position, rest } = getMotionTags(motion, { ...at, pos: { x: 0, y: 0 }, part: "card" });
  return `Dialogue: ${layer},${toAssTime(overlay.start)},${toAssTime(overlay.end)},OverlayShape,,0,0,0,,{\\an7${position}${rest}${getBlurTags(motion, at, 0)}\\1c${toTagColor(colour)}\\p1}${drawing}{\\p0}`;
}

/** A place card's pin above its title: there with the card, or dropping a little onto its place. */
function getPinEvents(overlay: Extract<ResolvedOverlay, { kind: "place_card" }>, at: OverlayPoint, colour: string, motion: DraftMotion): string[] {
  if (overlay.pin === undefined) return [];
  const size = getPlaceCardPinSize(overlay.fontSize);
  const drawing = getPinDrawing(at, size);
  if (overlay.pin === "static") return [getShapeEvent(overlay, drawing, colour, motion, 4)];
  const drop = r0(size * PIN_DROP_SHARE);
  const fade = motion.exit.kind === "none" ? 0 : motion.isSnappy ? r0(FADE_OUT_MS * 0.7) : FADE_OUT_MS;
  return [
    `Dialogue: 4,${toAssTime(overlay.start)},${toAssTime(overlay.end)},OverlayShape,,0,0,0,,{\\an7\\move(0,${-drop},0,0,0,${toMs(PIN_DROP_SECONDS)})\\fad(${r0(toMs(PIN_DROP_SECONDS) * 0.6)},${fade})\\1c${toTagColor(colour)}\\p1}${drawing}{\\p0}`,
  ];
}

/** A hook title, a search bar, a place card, a counter or a date stamp: a drawn rounded card and its text on layer 4. */
function getCardEvents(overlay: CardOverlay, context: DraftContext): string[] {
  const colors = getOverlayColors(overlay, context.brand);
  const { box, fontSize } = overlay;
  const name = overlay.entrance === null || overlay.entrance === "type" ? (overlay.typing !== null ? "fade" : DEFAULT_ENTRANCES[overlay.kind]) : overlay.entrance;
  const motion = getDraftMotion(overlay, name, box, context);
  const span = { start: overlay.start, end: overlay.end };
  const isMarked = overlay.kind === "hook_title" && overlay.backdrop === "highlight";
  const events = isMarked ? [] : getCardShapeEvents(overlay, box, fontSize, colors, motion, context);
  const { x: padX, y: padY } = getOverlayPadding(overlay);
  const centerX = box.left + box.width / 2;
  const tagsFor = (role: OverlayFontRole) => getTextTags(overlay, colors, context, role);
  const text = (pos: OverlayPoint, align: number, size: number, role: OverlayFontRole, steps: TextStep[], own: DraftMotion = motion) =>
    getTextEvents({ layer: 4, style: "OverlayPlain", pos, tags: `\\an${align}\\fs${r0(size)}${tagsFor(role)}`, steps, motion: own });
  const plain = { ...motion, name: "none" as const, entrance: { kind: "none" as const } };
  if (overlay.kind === "hook_title" || overlay.kind === "place_card") {
    // The text block sits in the card's middle; centred lines on its axis, left ones from its left edge (RV-131).
    const content = getTitleContentBox(overlay);
    const isLeft = overlay.align === "left";
    const lineX = isLeft ? content.left : centerX;
    const lineAlign = isLeft ? 7 : 8;
    let y = content.top;
    if (overlay.kind === "hook_title" && overlay.place !== null) {
      const size = overlay.placeFontSize;
      const pin = Math.round(size * 1.05);
      const rowWidth = pin + Math.round(size * 0.25) + estimateTextWidth(overlay.place, size);
      const rowLeft = isLeft ? content.left : centerX - rowWidth / 2;
      events.push(getShapeEvent(overlay, getPinDrawing({ x: rowLeft, y: y + (size * OVERLAY_LINE_HEIGHT - pin) / 2 }, pin), colors.accent, motion, 4));
      events.push(...text({ x: rowLeft + pin + Math.round(size * 0.25), y }, 7, size, OVERLAY_FONT_ROLES.date_stamp, [{ from: span.start, to: span.end, text: toAssText(overlay.place) }]));
      y += size * 1.3 + fontSize * 0.12;
    }
    const times = overlay.kind === "place_card" ? getPlaceCardTimes(overlay) : { pin: null, title: span.start, subtitle: null };
    if (overlay.kind === "place_card" && overlay.pin !== undefined) {
      const size = getPlaceCardPinSize(fontSize);
      events.push(...getPinEvents(overlay, { x: isLeft ? content.left : centerX - size / 2, y }, colors.accent, motion));
      y += getPlaceCardPinRow(fontSize);
    }
    const lineHeight = overlay.kind === "hook_title" ? OVERLAY_LINE_HEIGHT : OVERLAY_TITLE_LINE_HEIGHT;
    const titleMotion = times.title > span.start ? withFadeEntrance(motion) : motion;
    let typedBefore = 0;
    if (overlay.kind === "hook_title" && (isMarked || overlay.entrance === "drop")) {
      const letters = getDropLetterTimes(span.start, overlay.lines.join(""));
      overlay.lines.forEach((line) => {
        const lineStart = overlay.typing === null ? span.start : span.start + typedBefore / overlay.typing;
        if (isMarked) {
          const align = isLeft ? "left" : "center";
          events.push(...getBackdropMarkEvents({ text: line, x: lineX, align, top: y, fontSize, colour: colors.background, motion, span, typing: overlay.typing, typeFrom: lineStart }));
        }
        const steps =
          overlay.entrance === "drop"
            ? [{ from: span.start, to: span.end, text: getDropText(line, letters.slice(typedBefore, typedBefore + [...line].length), span.start) }]
            : getTypedSteps(line, { start: lineStart, end: span.end }, overlay.typing, !isLeft);
        const isQuiet = overlay.entrance === "drop" || (!isLeft && overlay.typing !== null);
        events.push(...text({ x: lineX, y }, lineAlign, fontSize, "heading", isLeft && overlay.entrance !== "drop" ? steps.map((step, index) => (index === 0 ? { ...step, from: span.start } : step)) : steps, isQuiet ? plain : motion));
        typedBefore += [...line].length;
        y += fontSize * lineHeight;
      });
      return events;
    }
    overlay.lines.forEach((line) => {
      // The lines type one after the other, as the render's characters do; a left line holds its place transparent
      // from the start, a centred one shows its typed part only (`getTypedSteps`).
      const lineStart = overlay.typing === null ? times.title : span.start + typedBefore / overlay.typing;
      const steps = getTypedSteps(line, { start: lineStart, end: span.end }, overlay.typing, !isLeft);
      // A centred typed line has no hidden first step to carry the entrance: its letters appear as typed, as the render's.
      const isTypedCentre = !isLeft && overlay.typing !== null;
      events.push(...text({ x: lineX, y }, lineAlign, fontSize, "heading", isLeft ? steps.map((step, index) => (index === 0 ? { ...step, from: span.start } : step)) : steps, isTypedCentre ? plain : titleMotion));
      typedBefore += [...line].length;
      y += fontSize * lineHeight;
    });
    if (overlay.kind === "place_card" && overlay.subtitle !== null) {
      const from = times.subtitle ?? span.start;
      events.push(...text({ x: lineX, y: y + fontSize * 0.12 }, lineAlign, overlay.subtitleFontSize, "interface", [{ from, to: span.end, text: toAssText(overlay.subtitle) }], from > span.start ? withFadeEntrance(motion) : motion));
    }
    return events;
  }
  if (overlay.kind === "search_bar") {
    const searchPadX = r0(fontSize * SEARCH_BAR_PADDING_EM.x);
    const middle = box.top + box.height / 2;
    events.push(getShapeEvent(overlay, getGlassDrawing({ x: box.left + searchPadX, y: middle - fontSize / 2 }, fontSize), colors.accent, motion, 4));
    events.push(...text({ x: box.left + searchPadX + Math.round(fontSize * SEARCH_BAR_ICON_EM), y: middle }, 4, fontSize, "interface", getTypedSteps(overlay.text, span, overlay.typing)));
    return events;
  }
  if (overlay.kind === "counter") {
    const unit = overlay.unit === null ? "" : `{\\fs${overlay.unitFontSize}} ${toAssText(overlay.unit)}`;
    const count = getCounterSeconds(overlay);
    const steps: TextStep[] = [];
    const ticks = Math.max(1, Math.round(count.duration / COUNT_STEP));
    const show = (value: number) => `${formatOverlayNumber(value, overlay.decimals, context.locale)}${unit}`;
    steps.push({ from: span.start, to: count.start, text: show(overlay.from) });
    for (let tick = 1; tick <= ticks; tick++) {
      const progress = tick / ticks;
      // power2.out, as the render's tween eases: the count slows down to its value.
      const eased = OVERLAY_EASES["power2.out"](progress);
      const value = overlay.from + (overlay.value - overlay.from) * eased;
      steps.push({ from: count.start + (tick - 1) * COUNT_STEP, to: tick === ticks ? span.end : count.start + tick * COUNT_STEP, text: show(value) });
    }
    return [...events, ...text({ x: centerX, y: box.top + box.height / 2 }, 5, fontSize, "heading", steps.filter((step) => step.to > step.from))];
  }
  const isRight = overlay.side === "right";
  const x = isRight ? box.left + box.width - padX : box.left + padX;
  events.push(...text({ x, y: box.top + padY }, isRight ? 9 : 7, fontSize, "interface", getTypedSteps(overlay.text, span, overlay.typing)));
  if (overlay.place !== null) {
    events.push(...text({ x, y: box.top + padY + fontSize * OVERLAY_LINE_HEIGHT }, isRight ? 9 : 7, overlay.placeFontSize, "interface", [{ from: span.start, to: span.end, text: toAssText(overlay.place) }]));
  }
  return events;
}

/** An arrow or a highlight in its accent. */
function getMarkEvents(overlay: Extract<ResolvedOverlay, { kind: "arrow" | "highlight" }>, context: DraftContext): string[] {
  const at = `${toAssTime(overlay.start)},${toAssTime(overlay.end)}`;
  const accent = toTagColor(getOverlayColors(overlay, context.brand).accent);
  const fade = overlay.entrance === "none" ? `\\fad(0,${FADE_OUT_MS})` : FADE;
  const colour = overlay.colors.accent === undefined ? "" : `\\1c${accent}`;
  if (overlay.kind === "arrow") {
    return [`Dialogue: 3,${at},OverlayShape,,0,0,0,,{\\an7\\pos(0,0)${fade}${colour}\\p1}${getArrowDrawing(overlay.from, overlay.to, context.scale)}{\\p0}`];
  }
  // libass grows a drawing's border outwards only: the shape is inset by half the stroke and bordered by all of
  // it, so the stroke straddles the rectangle's edge as the render's SVG stroke does.
  const stroke = r0(STROKE_WIDTH * context.scale);
  const half = stroke / 2;
  const [left, top] = [overlay.rect.left + half, overlay.rect.top + half];
  const [right, bottom] = [overlay.rect.left + overlay.rect.width - half, overlay.rect.top + overlay.rect.height - half];
  const shape = `m ${r0(left)} ${r0(top)} l ${r0(right)} ${r0(top)} ${r0(right)} ${r0(bottom)} ${r0(left)} ${r0(bottom)}`;
  return [`Dialogue: 3,${at},OverlayShape,,0,0,0,,{\\an7\\pos(0,0)${fade}\\1a&HFF&\\3c${accent}\\bord${stroke}\\p1}${shape}{\\p0}`];
}

/** A polygon as an ASS drawing. */
function getPolygonDrawing(points: readonly OverlayPoint[]): string {
  const [first, ...rest] = points;
  if (first === undefined) return "";
  return `m ${r0(first.x)} ${r0(first.y)} l ${rest.map((point) => `${r0(point.x)} ${r0(point.y)}`).join(" ")}`;
}

/** A stroke along `points` `width` px wide as an ASS drawing: one quad per segment and a square cap at each joint. */
function getStrokeDrawing(points: readonly OverlayPoint[], width: number): string {
  const half = width / 2;
  const parts: string[] = [];
  points.slice(1).forEach((to, index) => {
    const from = points[index] as OverlayPoint;
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const n = { x: (-(to.y - from.y) / length) * half, y: ((to.x - from.x) / length) * half };
    const u = { x: ((to.x - from.x) / length) * half, y: ((to.y - from.y) / length) * half };
    parts.push(getPolygonDrawing([
      { x: from.x - u.x + n.x, y: from.y - u.y + n.y },
      { x: to.x + u.x + n.x, y: to.y + u.y + n.y },
      { x: to.x + u.x - n.x, y: to.y + u.y - n.y },
      { x: from.x - u.x - n.x, y: from.y - u.y - n.y },
    ]));
  });
  return parts.join(" ");
}

/**
 * A note: its paper's torn outline and a soft shadow (layer 3), turned by its tilt about its middle (`\org`, `\frz`);
 * a card's handwritten words each fading in on its said second, a strip's capitals typed in after it grows; the tick
 * drawn from the left after the last word (layer 4). A strip's grow is the same `NOTE_GROW_FROM_SCALE` to full size.
 */
function getNoteEvents(overlay: Extract<ResolvedOverlay, { kind: "note" }>, context: DraftContext): string[] {
  const colors = getNoteColors(overlay);
  const centre = getNoteCentre(overlay);
  const turn = `\\org(${r0(centre.x)},${r0(centre.y)})\\frz${overlay.tilt}`;
  const isStrip = overlay.noteStyle === "strip";
  const frame = { width: 1080 * context.scale, height: 1920 * context.scale };
  const easing = overlay.easing ?? "smooth";
  const grow: OverlayEntranceMotion = { kind: "tween", from: { opacity: 1, scale: NOTE_GROW_FROM_SCALE, y: 0, blur: 0 }, seconds: NOTE_GROW_SECONDS, ease: "power2.out" };
  const name = overlay.entrance ?? (isStrip ? "pop" : "none");
  const motion: DraftMotion = {
    name,
    entrance: isStrip && overlay.entrance === null ? grow : getEntranceMotion(name, easing, frame),
    exit: getExitMotion({ exit: overlay.exit ?? "auto", entrance: overlay.entrance ?? "fade", easing, frame }),
    card: overlay.box,
    scale: context.scale,
    isSnappy: easing === "snappy",
    isCardMoved: name === "pop",
  };
  const at = { isFirst: true, isLast: true, ms: toMs(overlay.end - overlay.start) };
  const shapeTags = getMotionTags(motion, { ...at, pos: { x: 0, y: 0 }, part: "card" });
  const time = `${toAssTime(overlay.start)},${toAssTime(overlay.end)}`;
  const paper = getPolygonDrawing(getNotePaperPoints(overlay));
  const shadowOffset = r0(6 * context.scale);
  const shadow = getPolygonDrawing(getNotePaperPoints({ ...overlay, box: { ...overlay.box, top: overlay.box.top + shadowOffset } }));
  const events = [
    `Dialogue: 3,${time},OverlayShape,,0,0,0,,{\\an7${shapeTags.position}${shapeTags.rest}${turn}\\blur${r0(10 * context.scale)}\\1c&H000000&\\1a&HB0&\\p1}${shadow}{\\p0}`,
    `Dialogue: 3,${time},OverlayShape,,0,0,0,,{\\an7${shapeTags.position}${shapeTags.rest}${turn}\\1c${toTagColor(colors.paper)}\\p1}${paper}{\\p0}`,
  ];
  const textBox = getNoteTextBox(overlay);
  const lineHeight = overlay.fontSize * NOTE_LINE_HEIGHT;
  const font = isStrip ? `${context.fonts.heading === undefined ? "" : `\\fn${context.fonts.heading}`}\\b1` : `\\fn${HAND_FONT.family}\\b0`;
  const textMotion = getPlainMotion(motion);
  // libass sizes the hand font by its ascent and descent: its \\fs is scaled so the letters match the render's.
  const assSize = isStrip ? overlay.fontSize : getHandFontAssSize(overlay.fontSize);
  const tags = `\\an7\\fs${assSize}${font}\\1c${toTagColor(colors.ink)}${turn}`;
  getNoteWordsByLine(overlay).forEach((words, index) => {
    const pos = { x: textBox.left, y: textBox.top + index * lineHeight };
    const line = overlay.lines[index] as string;
    const span = { start: overlay.start, end: overlay.end };
    if (isStrip) {
      const before = overlay.lines.slice(0, index).join("").length;
      const typing = overlay.typing ?? 14;
      const steps = getTypedSteps(line, { start: overlay.start + before / typing, end: overlay.end }, typing).map((step, stepIndex) => (stepIndex === 0 ? { ...step, from: overlay.start } : step));
      events.push(...getTextEvents({ layer: 4, style: "OverlayPlain", pos, tags, steps, motion: textMotion }));
      return;
    }
    const fade = 100;
    const shown = words.map((word) => `{\\alpha&HFF&\\t(${toMs(word.at - span.start)},${toMs(word.at - span.start) + fade},\\alpha&H00&)}${toAssText(word.text)}`).join(" ");
    events.push(...getTextEvents({ layer: 4, style: "OverlayPlain", pos, tags, steps: [{ from: span.start, to: span.end, text: shown }], motion: textMotion }));
  });
  if (overlay.tickAt !== null) {
    const points = getNoteTickPoints(overlay);
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const room = overlay.fontSize * 0.2;
    const clip = { x0: r0(Math.min(...xs) - room), y0: r0(Math.min(...ys) - room), x1: r0(Math.max(...xs) + room), y1: r0(Math.max(...ys) + room) };
    const draw = `${toClip({ ...clip, x1: clip.x0 })}\\t(0,${toMs(NOTE_TICK_SECONDS)},${toClip(clip)})`;
    const fade = motion.exit.kind === "none" ? "" : `\\fad(0,${FADE_OUT_MS})`;
    events.push(`Dialogue: 4,${toAssTime(overlay.tickAt)},${toAssTime(overlay.end)},OverlayShape,,0,0,0,,{\\an7\\pos(0,0)${fade}${draw}${turn}\\1c${toTagColor(colors.tick)}\\p1}${getStrokeDrawing(points, overlay.fontSize * 0.12)}{\\p0}`);
  }
  return events;
}

/** An end word: one big handwritten line at the top, no card, white with a soft shadow, its letters dropping in (or its own entrance). */
function getEndWordEvents(overlay: Extract<ResolvedOverlay, { kind: "end_word" }>, context: DraftContext): string[] {
  const name = overlay.entrance ?? "drop";
  const motion = getDraftMotion(overlay, name, overlay.box, context);
  const colour = overlay.colors.text ?? "#ffffff";
  const tags = `\\an8\\fs${getHandFontAssSize(overlay.fontSize)}\\fn${HAND_FONT.family}\\b0\\1c${toTagColor(colour)}\\shad${r0(3 * context.scale)}\\4c&H000000&\\4a&H90&`;
  const pos = { x: overlay.box.left + overlay.box.width / 2, y: overlay.box.top };
  const span = { start: overlay.start, end: overlay.end };
  if (name === "drop") {
    const text = getDropText(overlay.text, getDropLetterTimes(span.start, overlay.text), span.start);
    return getTextEvents({ layer: 4, style: "OverlayPlain", pos, tags, steps: [{ from: span.start, to: span.end, text }], motion: getPlainMotion(motion) });
  }
  return getTextEvents({ layer: 4, style: "OverlayPlain", pos, tags, steps: [{ from: span.start, to: span.end, text: toAssText(overlay.text) }], motion });
}

/**
 * The overlays as ASS events, layers 3 and 4. `fonts` names the heading and interface families where they are not the
 * styles' own (the captions' font); `locale` groups a counter's number as the render does.
 */
export function buildDraftOverlayEvents(
  overlays: readonly ResolvedOverlay[],
  colors: OverlayColors,
  frame: { width: number; height: number },
  options: { fonts?: Partial<Record<OverlayFontRole, string>>; locale?: string; style?: BrandStyle } = {},
): string[] {
  const context: DraftContext = { brand: colors, scale: frame.width / 1080, locale: options.locale ?? "en-US", fonts: options.fonts ?? {}, ...(options.style === undefined ? {} : { style: options.style }) };
  return overlays.flatMap((overlay) => {
    if (overlay.kind === "punch_in") return [];
    if (overlay.kind === "arrow" || overlay.kind === "highlight") return getMarkEvents(overlay, context);
    if (overlay.kind === "keyword" || overlay.kind === "lower_third" || overlay.kind === "list") return getSideTextEvents(overlay, context);
    if (overlay.kind === "note") return getNoteEvents(overlay, context);
    if (overlay.kind === "end_word") return getEndWordEvents(overlay, context);
    return getCardEvents(overlay, context);
  });
}
