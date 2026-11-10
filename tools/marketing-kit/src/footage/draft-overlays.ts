import { getCornerRadiusPx, type BrandStyle, type CornerRadius } from "./brand-style.js";
import { getDraftBoxEvents } from "./draft-boxes.js";
import { toAssColor } from "./draft-color.js";
import { getCounterSeconds, getOverlayColors, getTypingTimes, type OverlayColors } from "./overlay-html.js";
import {
  OVERLAY_FONT_ROLES,
  OVERLAY_LINE_HEIGHT,
  OVERLAY_LIST_LINE_HEIGHT,
  OVERLAY_PADDING_EM,
  OVERLAY_TITLE_LINE_HEIGHT,
  SEARCH_BAR_ICON_EM,
  SEARCH_BAR_PADDING_EM,
  estimateTextWidth,
  formatOverlayNumber,
  getDrawnOverlayCard,
  getSideTextLines,
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
export function getDraftCardRadius(overlay: { kind: string; cornerRadius: CornerRadius | null }, box: { height: number }, context: Pick<DraftContext, "style" | "scale">, own: number): number {
  const token = overlay.cornerRadius ?? (context.style === undefined ? null : overlay.kind === "search_bar" ? "pill" : context.style.cornerRadius);
  return token === null ? own : getCornerRadiusPx(token, box.height, context.scale);
}

/** One stretch of an overlay's text: what shows from `from` to `to`, and its tags. */
interface TextStep {
  from: number;
  to: number;
  text: string;
}

/** The entrance and exit tags of a run of events: the first fades or slides in, the last fades out. */
function getMotionTags(entrance: "fade" | "slide" | "none", isFirst: boolean, isLast: boolean, slide: { x: number; y: number; dy: number } | null): string {
  const fadeIn = isFirst && entrance !== "none" ? FADE_IN_MS : 0;
  const fadeOut = isLast ? FADE_OUT_MS : 0;
  const fade = fadeIn === 0 && fadeOut === 0 ? "" : `\\fad(${fadeIn},${fadeOut})`;
  const move = isFirst && entrance === "slide" && slide !== null ? `\\move(${r0(slide.x)},${r0(slide.y + slide.dy)},${r0(slide.x)},${r0(slide.y)},0,${SLIDE_MS})` : "";
  return `${move}${fade}`;
}

/** Text events for a run of steps, positioned at `pos` with `tags`, the entrance on the first and the fade out on the last. */
function getTextEvents(input: { layer: number; style: string; pos: OverlayPoint; tags: string; steps: TextStep[]; entrance: "fade" | "slide" | "none"; slidePx: number }): string[] {
  return input.steps.map((step, index) => {
    const motion = getMotionTags(input.entrance, index === 0, index === input.steps.length - 1, { x: input.pos.x, y: input.pos.y, dy: input.slidePx });
    const pos = motion.includes("\\move") ? "" : `\\pos(${r0(input.pos.x)},${r0(input.pos.y)})`;
    return `Dialogue: ${input.layer},${toAssTime(step.from)},${toAssTime(step.to)},${input.style},,0,0,0,,{${input.tags}${pos}${motion}}${step.text}`;
  });
}

/** The steps of a text that types in letter by letter (the rest transparent), or one step showing it all. */
function getTypedSteps(text: string, span: { start: number; end: number }, typing: number | null): TextStep[] {
  const clean = toAssText(text);
  if (typing === null || clean.length === 0) return [{ from: span.start, to: span.end, text: clean }];
  const chars = [...clean];
  const times = getTypingTimes(span.start, clean, typing).map((time) => Math.min(time, span.end));
  const steps: TextStep[] = [{ from: span.start, to: times[0] as number, text: `${HIDDEN}${clean}` }];
  times.forEach((time, index) => {
    const shown = chars.slice(0, index + 1).join("");
    const rest = chars.slice(index + 1).join("");
    steps.push({ from: time, to: times[index + 1] ?? span.end, text: rest.length === 0 ? shown : `${shown}${HIDDEN}${rest}` });
  });
  return steps.filter((step) => step.to > step.from);
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

/** The corner radius of a keyword's, a lower third's or a list's card: the render's `.ov-card` (0.42 em). */
function getSideCardRadius(fontSize: number): number {
  return fontSize * 0.42;
}

/**
 * A keyword, a lower third or a list: a drawn rounded card fitted to its text (`getDrawnOverlayCard`) on layer 3 and
 * its text on layer 4, inset by the card's padding on its side (a lower third from its foot).
 */
function getSideTextEvents(overlay: Extract<ResolvedOverlay, { kind: "keyword" | "lower_third" | "list" }>, context: DraftContext): string[] {
  const colors = getOverlayColors(overlay, context.brand);
  const { fontSize, side } = overlay;
  // A side text always has a card: only a punch_in has none.
  const card = getDrawnOverlayCard(overlay) as OverlayBox;
  const padX = r0(fontSize * OVERLAY_PADDING_EM.x);
  const padY = r0(fontSize * OVERLAY_PADDING_EM.y);
  const isRight = side === "right";
  const x = isRight ? card.left + card.width - padX : card.left + padX;
  const isFoot = overlay.kind === "lower_third";
  const y = isFoot ? card.top + card.height - padY : card.top + padY;
  // \an: 7 top left, 9 top right, 1 bottom left, 3 bottom right.
  const align = isFoot ? (isRight ? 3 : 1) : isRight ? 9 : 7;
  const entrance = overlay.entrance === null || overlay.entrance === "type" ? "fade" : overlay.entrance;
  const span = { start: overlay.start, end: overlay.end };
  const tags = `\\an${align}\\fs${fontSize}${getTextTags(overlay, colors, context, OVERLAY_FONT_ROLES[overlay.kind])}`;
  const text = (pos: OverlayPoint, steps: TextStep[]) => getTextEvents({ layer: 4, style: "OverlayPlain", pos, tags, steps, entrance, slidePx: SLIDE_PX * context.scale });
  const shape = getShapeEvent(overlay, getRoundedRectDrawing(card, getSideCardRadius(fontSize)), colors.background, entrance, context.scale);
  if (overlay.kind === "list") {
    // One event per point, on the render's line height (libass's own line spacing is tighter), all shown at once.
    const step = fontSize * OVERLAY_LIST_LINE_HEIGHT;
    const lead = (step - fontSize * OVERLAY_LINE_HEIGHT) / 2;
    return [shape, ...getSideTextLines(overlay).flatMap((line, index) => text({ x, y: y + lead + index * step }, [{ from: span.start, to: span.end, text: toAssText(line) }]))];
  }
  // A keyword or a lower third types in only when its entrance says so.
  return [shape, ...text({ x, y }, overlay.entrance === null ? [{ from: span.start, to: span.end, text: toAssText(overlay.text) }] : getTypedSteps(overlay.text, span, overlay.typing))];
}

type CardOverlay = Extract<ResolvedOverlay, { kind: "hook_title" | "search_bar" | "place_card" | "counter" | "date_stamp" }>;

/** Each card's own entrance when the overlay names none (a typed card fades its card in). */
const DEFAULT_ENTRANCES = { hook_title: "slide", search_bar: "fade", place_card: "slide", counter: "fade", date_stamp: "fade" } as const;

/** A drawing event in the overlay's card colour (or accent), with the overlay's entrance. */
function getShapeEvent(overlay: Pick<ResolvedOverlay, "start" | "end">, drawing: string, colour: string, entrance: "fade" | "slide" | "none", scale: number): string {
  const motion = getMotionTags(entrance, true, true, { x: 0, y: 0, dy: SLIDE_PX * scale });
  const pos = motion.includes("\\move") ? "" : "\\pos(0,0)";
  return `Dialogue: 3,${toAssTime(overlay.start)},${toAssTime(overlay.end)},OverlayShape,,0,0,0,,{\\an7${pos}${motion}\\1c${toTagColor(colour)}\\p1}${drawing}{\\p0}`;
}

/** A hook title, a search bar, a place card, a counter or a date stamp: a drawn rounded card and its text on layer 4. */
function getCardEvents(overlay: CardOverlay, context: DraftContext): string[] {
  const colors = getOverlayColors(overlay, context.brand);
  const { box, fontSize } = overlay;
  const entrance = overlay.entrance === null || overlay.entrance === "type" ? (overlay.typing !== null ? "fade" : DEFAULT_ENTRANCES[overlay.kind]) : overlay.entrance;
  const slidePx = SLIDE_PX * context.scale;
  const span = { start: overlay.start, end: overlay.end };
  const radius = getDraftCardRadius(overlay, box, context, overlay.kind === "search_bar" ? box.height / 2 : fontSize * 0.42);
  const events =
    context.style === undefined
      ? [getShapeEvent(overlay, getRoundedRectDrawing(box, radius), colors.background, entrance, context.scale)]
      : getDraftBoxEvents({
          layer: 3,
          at: `${toAssTime(overlay.start)},${toAssTime(overlay.end)}`,
          styleName: "OverlayShape",
          box,
          radius,
          color: colors.background,
          accent: colors.accent,
          style: context.style,
          scale: context.scale,
          motion: getMotionTags(entrance, true, true, { x: 0, y: 0, dy: SLIDE_PX * context.scale }),
        });
  const padX = r0(fontSize * OVERLAY_PADDING_EM.x);
  const padY = r0(fontSize * OVERLAY_PADDING_EM.y);
  const centerX = box.left + box.width / 2;
  const tagsFor = (role: OverlayFontRole) => getTextTags(overlay, colors, context, role);
  const text = (pos: OverlayPoint, align: number, size: number, role: OverlayFontRole, steps: TextStep[]) =>
    getTextEvents({ layer: 4, style: "OverlayPlain", pos, tags: `\\an${align}\\fs${r0(size)}${tagsFor(role)}`, steps, entrance, slidePx });
  if (overlay.kind === "hook_title" || overlay.kind === "place_card") {
    let y = box.top + padY;
    if (overlay.kind === "hook_title" && overlay.place !== null) {
      const size = overlay.placeFontSize;
      const pin = Math.round(size * 1.05);
      const rowWidth = pin + Math.round(size * 0.25) + estimateTextWidth(overlay.place, size);
      const rowLeft = centerX - rowWidth / 2;
      events.push(getShapeEvent(overlay, getPinDrawing({ x: rowLeft, y: y + (size * OVERLAY_LINE_HEIGHT - pin) / 2 }, pin), colors.accent, entrance, context.scale).replace("Dialogue: 3,", "Dialogue: 4,"));
      events.push(...text({ x: rowLeft + pin + Math.round(size * 0.25), y }, 7, size, OVERLAY_FONT_ROLES.date_stamp, [{ from: span.start, to: span.end, text: toAssText(overlay.place) }]));
      y += size * 1.3 + fontSize * 0.12;
    }
    const lineHeight = overlay.kind === "hook_title" ? OVERLAY_LINE_HEIGHT : OVERLAY_TITLE_LINE_HEIGHT;
    let typedBefore = 0;
    overlay.lines.forEach((line) => {
      // The lines type one after the other, as the render's characters do.
      const lineStart = overlay.typing === null ? span.start : span.start + typedBefore / overlay.typing;
      events.push(...text({ x: centerX, y }, 8, fontSize, "heading", getTypedSteps(line, { start: lineStart, end: span.end }, overlay.typing).map((step, index) => (index === 0 ? { ...step, from: span.start } : step))));
      typedBefore += [...line].length;
      y += fontSize * lineHeight;
    });
    if (overlay.kind === "place_card" && overlay.subtitle !== null) {
      events.push(...text({ x: centerX, y: y + fontSize * 0.12 }, 8, overlay.subtitleFontSize, "interface", [{ from: span.start, to: span.end, text: toAssText(overlay.subtitle) }]));
    }
    return events;
  }
  if (overlay.kind === "search_bar") {
    const searchPadX = r0(fontSize * SEARCH_BAR_PADDING_EM.x);
    const middle = box.top + box.height / 2;
    events.push(getShapeEvent(overlay, getGlassDrawing({ x: box.left + searchPadX, y: middle - fontSize / 2 }, fontSize), colors.accent, entrance, context.scale).replace("Dialogue: 3,", "Dialogue: 4,"));
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
      // power2.out, as the render's tween eases.
      const eased = 1 - (1 - progress) ** 2;
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
    return getCardEvents(overlay, context);
  });
}
