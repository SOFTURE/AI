import type { BrandColors } from "../config/colors.js";
import { escapeHtml } from "../compose/html.js";
import { getCornerRadiusCss, getStyleBorderCss, getStyleShadowCss, type BrandStyle } from "./brand-style.js";
import type { OverlayEntrance } from "./overlay-schema.js";
import { HAND_FONT } from "./hand-font.js";
import {
  DROP_FROM_EM,
  DROP_LETTER_GAP,
  DROP_LETTER_SECONDS,
  NOTE_GROW_FROM_SCALE,
  NOTE_GROW_SECONDS,
  NOTE_TICK_SECONDS,
  getDropLetterTurns,
  PIN_DROP_SECONDS,
  PIN_DROP_SHARE,
  PIN_TITLE_LEAD,
  UNDERLINE_EM,
  UNDERLINE_SECONDS,
  getEntranceMotion,
  getExitMotion,
  getWipeHalves,
  type OverlayEntranceMotion,
  type OverlayMotionOffset,
} from "./overlay-motion.js";
import {
  NOTE_LINE_HEIGHT,
  OVERLAY_LINE_HEIGHT,
  OVERLAY_LIST_LINE_HEIGHT,
  OVERLAY_PADDING_EM,
  OVERLAY_TITLE_LINE_HEIGHT,
  SEARCH_BAR_PADDING_EM,
  formatOverlayNumber,
  getOverlayPadding,
  getPlaceCardPinRow,
  getPlaceCardPinSize,
  getListCardsByItem,
  getListItemTimes,
  getNoteColors,
  getNotePaperPoints,
  getNoteTextBox,
  getNoteTickPoints,
  getNoteWordsByLine,
  getTitleContentBox,
  isHandFontNeeded,
  type OverlayBox,
  type ResolvedOverlay,
} from "./overlays.js";

/**
 * The render's overlays (issue #1200): HTML, CSS and GSAP tweens for the HyperFrames composition, every look in the
 * brand's colours and fonts (or the overlay's own colours) and every element a local clip (no network at render time).
 *
 * The motion is adapted from HyperFrames registry blocks (Apache-2.0, https://github.com/heygen-com/hyperframes):
 * `lt-soft-pill` (the lower third's scale-pop pill, dot and settling text), `marker-highlight` (the stroke drawn over
 * its target), `hw-arrow` (the drawn-on arrow whose head arrives last) and `push-in` (the eased camera push, in
 * `composeFootage`). They are rewritten for the kit's frame, timeline and brand tokens: see the package's NOTICE. The
 * entrances and exits (`overlay-motion.ts`), the typed search field, the counting number and the drawn pin are the
 * kit's own, eased without overshoot: nothing grows past its size.
 */

/** The seconds an overlay takes to leave, ending with its clip. */
const EXIT_SECONDS = 0.3;
/** An arrow's or a highlight's stroke, in px of a 1080 px wide frame. */
const STROKE_WIDTH = 10;
/** The arrow head's length, in px of a 1080 px wide frame. */
const ARROW_HEAD = 46;
/** When a typed overlay starts typing, after its card has faded in, in seconds from its start. */
export const OVERLAY_TYPING_DELAY = 0.3;
/** When a counter starts counting, in seconds from its start. */
const COUNT_DELAY = 0.15;

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

export interface OverlayMarkup {
  html: string[];
  css: string[];
  tweens: string[];
}

/** The brand's colours an overlay paints with: its card, its text, its accent (the dot, the arrow, the marker). */
export type OverlayColors = Pick<BrandColors, "background" | "foreground" | "accent">;

/** An overlay's colours: its own where it sets them, else the brand's. */
export function getOverlayColors(overlay: ResolvedOverlay, brand: OverlayColors): OverlayColors {
  const own = overlay.kind === "punch_in" ? {} : overlay.colors;
  return { background: own.card ?? brand.background, foreground: own.text ?? brand.foreground, accent: own.accent ?? brand.accent };
}

/** The seconds a counter counts over (from `COUNT_DELAY` after its start): half its span, between 0.6 and 1.6 s. */
export function getCounterSeconds(overlay: { start: number; end: number }): { start: number; duration: number } {
  return { start: r3(overlay.start + COUNT_DELAY), duration: r3(Math.min(1.6, Math.max(0.6, (overlay.end - overlay.start) * 0.5))) };
}

/** The film seconds each character of a typed text appears at, from `OVERLAY_TYPING_DELAY` after the overlay's start. */
export function getTypingTimes(start: number, text: string, speed: number): number[] {
  return [...text].map((_char, index) => r3(start + OVERLAY_TYPING_DELAY + index / speed));
}

/** The CSS every overlay kind shares, written once when the film has any drawn overlay. */
function getOverlayCss(colors: OverlayColors, fonts: { heading: string; interface: string }, style?: BrandStyle, scale = 1): string[] {
  return [
    `.ov{position:absolute;display:flex;pointer-events:none}`,
    `.ov.right{justify-content:flex-end}`,
    `.ov.center{justify-content:center}`,
    `.ov-card{display:flex;align-items:center;gap:.45em;padding:${OVERLAY_PADDING_EM.y}em ${OVERLAY_PADDING_EM.x}em;border-radius:.42em;background:${colors.background};color:${colors.foreground};box-shadow:0 14px 44px rgba(0,0,0,.35);line-height:${OVERLAY_LINE_HEIGHT};font-family:${fonts.interface};font-weight:700;letter-spacing:-.015em;max-width:100%;overflow-wrap:anywhere;transform-origin:0% 100%}`,
    `.ov.right .ov-card{transform-origin:100% 100%}`,
    `.ov-keyword .ov-card{font-family:${fonts.heading};border-bottom:.12em solid ${colors.accent}}`,
    `.ov-dot{flex:none;width:.36em;height:.36em;border-radius:50%;background:${colors.accent}}`,
    `.ov-list .ov-card{flex-direction:column;align-items:flex-start;gap:0;line-height:${OVERLAY_LIST_LINE_HEIGHT};font-weight:650}`,
    `.ov-list li{display:flex;align-items:center;gap:.45em;list-style:none}`,
    // A list's card grows with its points (RV-144 of an adopting app): sized per point, the later points clipped until
    // they come in; a centred stack centres its lines, and chips are cards of their own, one per point.
    `.ov-list .ov-card.grow{box-sizing:border-box;overflow:hidden;flex:none}`,
    `.ov-list .ov-card.cen{align-items:center;text-align:center}`,
    `.ov-list li{white-space:nowrap}`,
    `.ov.center .ov-card{transform-origin:50% 100%}`,
    // A centred keyword (style.align center) centres a line that wraps too.
    `.ov-keyword.center .ov-card{justify-content:center;text-align:center}`,
    `.ov-list .ov-chip{position:absolute;box-sizing:border-box;flex-direction:row;align-items:center;justify-content:center;white-space:nowrap;line-height:${OVERLAY_LINE_HEIGHT};transform-origin:50% 100%}`,
    `.ov-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}`,
    `.ov-search,.ov-counter .ov-card,.ov-date .ov-card,.ov-place,.ov-sub,.ov-line{white-space:nowrap}`,
    // A title card fills its fitted box, so a typed title keeps its width; a centred typed line hides its untyped
    // characters (they take no room), so what is typed stays centred (RV-131 of an adopting app).
    `.ov-stack{flex-direction:column;justify-content:center;gap:0;text-align:center;width:100%;height:100%;box-sizing:border-box;transform-origin:50% 0%}`,
    `.ov-stack.left{align-items:flex-start;text-align:left}`,
    `.ov-stack.left .ov-place{justify-content:flex-start}`,
    `.ov-line{min-height:1lh}`,
    `.ty .ov-stack:not(.left) .ch{display:none}`,
    `.ov-hook-title .ov-line{font-family:${fonts.heading};font-weight:800;letter-spacing:-.02em}`,
    `.ov-place{display:flex;align-items:center;justify-content:center;gap:.25em;font-weight:650;opacity:.92;margin-bottom:.12em}`,
    `.ov-pin{flex:none;width:1.05em;height:1.05em}`,
    `.ov-place-card .ov-line{font-family:${fonts.heading};font-weight:800;line-height:${OVERLAY_TITLE_LINE_HEIGHT};letter-spacing:-.025em}`,
    `.ov-sub{font-weight:600;opacity:.88;margin-top:.12em}`,
    `.ov-search{width:100%;border-radius:999px;padding:${SEARCH_BAR_PADDING_EM.y}em ${SEARCH_BAR_PADDING_EM.x}em;gap:.5em;font-weight:600;letter-spacing:0;justify-content:flex-start;transform-origin:50% 50%}`,
    `.ov-glass{flex:none;width:1em;height:1em}`,
    `.ov-counter .ov-card{font-family:${fonts.heading};font-weight:800;align-items:baseline;gap:.3em;font-variant-numeric:tabular-nums;transform-origin:50% 50%}`,
    `.ov-date .ov-card{flex-direction:column;gap:0;font-weight:800}`,
    `.ov-date.right .ov-card{align-items:flex-end}`,
    `.ov-date:not(.right) .ov-card{align-items:flex-start}`,
    `.ov-date .ov-sub{font-weight:600;margin-top:0}`,
    `.ty .ch{opacity:0}`,
    // A wipe's accent panel over its card, the keyword's underline, a dropped pin, and the parts that come in later.
    `.ov-card{position:relative}`,
    `.ov-wipe{position:absolute;inset:0;border-radius:inherit;background:${colors.accent};transform-origin:100% 50%}`,
    `.ov-ul{position:absolute;height:${UNDERLINE_EM.height}em;border-radius:${UNDERLINE_EM.height / 2}em;background:${colors.accent};transform:scaleX(0);transform-origin:0% 50%}`,
    `.ov-pinrow{display:flex;justify-content:center}`,
    `.ov-stack.left .ov-pinrow{justify-content:flex-start}`,
    `.pd .ov-pinrow svg,.pl .ov-line,.sd .ov-sub{opacity:0}`,
    // An underlined keyword keeps only its drawn bar: the card's own accent edge would be a second line under it.
    `.ov-keyword.ul .ov-card{border-bottom-color:transparent}`,
    // Dropped letters: each its own box, hidden until it starts falling.
    `.dl{display:inline-block;opacity:0}`,
    // A highlight backdrop: no card, each line on its own tight box that grows with the typed letters.
    `.ov-mark{padding:.04em .22em;border-radius:.14em;-webkit-box-decoration-break:clone;box-decoration-break:clone}`,
    `.ty .hl .ch{display:none}`,
    // A typed line's mark waits for its first letter: an empty mark would show as a bare block of padding.
    `.ty .hl .ov-mark{display:none}`,
    // A note: its paper (an SVG outline with a torn edge and a soft shadow), its lines placed in px, its words hidden until said.
    `.ov-note .nb{position:absolute;inset:0;transform-origin:50% 50%}`,
    `.ov-note .paper{position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 6px 14px rgba(0,0,0,.28))}`,
    `.ov-note .nt{position:absolute;white-space:nowrap;line-height:${NOTE_LINE_HEIGHT}}`,
    `.ov-note .nw{opacity:0}`,
    `.ov-note .tick{position:absolute;inset:0;overflow:visible}`,
    `.ov-strip .nt{font-family:${fonts.heading};font-weight:800;letter-spacing:.02em}`,
    `.ov-hand{font-family:"${HAND_FONT.family}",cursive;font-weight:400}`,
    `.ov-endword{white-space:nowrap;line-height:${OVERLAY_LINE_HEIGHT};text-shadow:0 3px 10px rgba(0,0,0,.45)}`,
    // The brand's style (after the kinds' own rules, so it wins over them; the search bar stays a pill).
    ...(style === undefined
      ? []
      : [
          `.ov-card{border-radius:${getCornerRadiusCss(style.cornerRadius, scale)};box-shadow:${getStyleShadowCss(style, scale)};border:${getStyleBorderCss(style, colors.accent, scale)}}`,
          `.ov-search{border-radius:999px}`,
          ...(style.border === "none" ? [] : [`.ov-keyword .ov-card{border-bottom:.12em solid ${colors.accent}}`]),
        ]),
    // After the brand's style, so a highlight backdrop never draws the card under its marks.
    `.ov .ov-card.hl{background:transparent;box-shadow:none;border:none}`,
  ];
}

/** The hand font's face, when a note card or an end word is drawn: the kit's file, copied to `src` by the render. */
function getHandFontCss(overlays: readonly ResolvedOverlay[], src: string): string[] {
  return isHandFontNeeded(overlays) ? [`@font-face{font-family:"${HAND_FONT.family}";src:url("${src}") format("truetype");font-weight:400;font-style:normal}`] : [];
}

/** A text whose letters drop in: each letter its own box (spaces stay text, so the line breaks and spaces as before). */
function toDropHtml(text: string): string {
  return [...text].map((char) => (char.trim() === "" ? " " : `<span class="dl">${escapeHtml(char)}</span>`)).join("");
}

/**
 * The tweens of dropped letters under `target`: each falls from `DROP_FROM_EM` above with its turn and lands eased out
 * (`power2.out`, never past its place), `DROP_LETTER_GAP` after the one before, fading in over its first half.
 */
function getDropTweens(target: string, text: string, start: number, fontSize: number): string[] {
  const turns = getDropLetterTurns([...text].filter((char) => char.trim() !== "").join(""));
  return [
    `tl.fromTo("${target} .dl", { y: ${r3(-DROP_FROM_EM * fontSize)}, rotation: (i) => ${JSON.stringify(turns)}[i] }, { y: 0, rotation: 0, duration: ${DROP_LETTER_SECONDS}, ease: "power2.out", stagger: ${DROP_LETTER_GAP}, immediateRender: false }, ${r3(start)});`,
    `tl.fromTo("${target} .dl", { opacity: 0 }, { opacity: 1, duration: ${r3(DROP_LETTER_SECONDS / 2)}, ease: "none", stagger: ${DROP_LETTER_GAP}, immediateRender: false }, ${r3(start)});`,
  ];
}

/** The SVG path of an arrow from `from` to `to`: a gentle curve bowed to one side, and its head's two strokes. */
export function getArrowPaths(overlay: Extract<ResolvedOverlay, { kind: "arrow" }>, scale: number): { curve: string; head: string } {
  const { from, to } = overlay;
  const [dx, dy] = [to.x - from.x, to.y - from.y];
  const length = Math.hypot(dx, dy) || 1;
  // The control point sits off the middle by a fifth of the length, on the left of the travel (a hand-drawn bow).
  const bow = 0.2 * length;
  const control = { x: from.x + dx / 2 + (dy / length) * bow, y: from.y + dy / 2 - (dx / length) * bow };
  const angle = Math.atan2(to.y - control.y, to.x - control.x);
  const head = ARROW_HEAD * scale;
  const wing = (turn: number) => ({ x: to.x - head * Math.cos(angle + turn), y: to.y - head * Math.sin(angle + turn) });
  const [left, right] = [wing(Math.PI / 6), wing(-Math.PI / 6)];
  const f = (value: number) => String(r3(value));
  return {
    curve: `M${f(from.x)} ${f(from.y)} Q${f(control.x)} ${f(control.y)} ${f(to.x)} ${f(to.y)}`,
    head: `M${f(left.x)} ${f(left.y)} L${f(to.x)} ${f(to.y)} L${f(right.x)} ${f(right.y)}`,
  };
}

/** A map pin drawn in the accent: a rounded drop with a hole, one line of the label tall. */
function getPinSvg(accent: string): string {
  return `<svg class="ov-pin" viewBox="0 0 24 24"><path fill="${accent}" fill-rule="evenodd" d="M12 1.5c-4.3 0-7.75 3.4-7.75 7.6 0 5.6 7.75 13.4 7.75 13.4s7.75-7.8 7.75-13.4c0-4.2-3.45-7.6-7.75-7.6zm0 10.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>`;
}

/** A magnifier drawn in the accent. */
function getGlassSvg(accent: string): string {
  return `<svg class="ov-glass" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.6" fill="none" stroke="${accent}" stroke-width="2.6"/><path d="M15 15l6 6" stroke="${accent}" stroke-width="2.6" stroke-linecap="round"/></svg>`;
}

/** A text as one span per character, for the typed entrance (spaces kept). */
function toTypedHtml(text: string): string {
  return [...text].map((char) => `<span class="ch">${char === " " ? "&#32;" : escapeHtml(char)}</span>`).join("");
}

/** The inline colours of a card that has its own. */
function getCardStyle(overlay: ResolvedOverlay, colors: OverlayColors, scale = 1): string {
  if (overlay.kind === "punch_in") return "";
  const own = overlay.colors;
  const isMarked = (overlay.kind === "hook_title" || overlay.kind === "keyword") && overlay.backdrop === "highlight";
  const parts = [own.card === undefined || isMarked ? "" : `background:${colors.background}`, own.text === undefined ? "" : `color:${colors.foreground}`];
  if (overlay.cornerRadius !== undefined && overlay.cornerRadius !== null) parts.push(`border-radius:${getCornerRadiusCss(overlay.cornerRadius, scale)}`);
  if (overlay.kind === "hook_title" || overlay.kind === "place_card") {
    // The text block sits where the draft draws it: the card's padding is what its fitted box leaves round it.
    const content = getTitleContentBox(overlay);
    parts.push(`padding:${r3(content.top - overlay.box.top)}px ${r3(content.left - overlay.box.left)}px`);
  } else if (overlay.padScale !== undefined && overlay.kind !== "search_bar" && overlay.kind !== "arrow" && overlay.kind !== "highlight") {
    const pad = getOverlayPadding(overlay);
    parts.push(`padding:${pad.y}px ${pad.x}px`);
  }
  if (overlay.kind === "keyword" && own.accent !== undefined) parts.push(`border-bottom-color:${colors.accent}`);
  const style = parts.filter((part) => part !== "").join(";");
  return style === "" ? "" : ` style="${style}"`;
}

/** The GSAP properties of a motion offset: only what differs from rest, in a fixed order. */
function toTweenVars(offset: OverlayMotionOffset): string[] {
  return [
    `opacity: ${offset.opacity}`,
    ...(offset.scale === 1 ? [] : [`scale: ${offset.scale}`]),
    ...(offset.y === 0 ? [] : [`y: ${offset.y}`]),
    ...(offset.blur === 0 ? [] : [`filter: "blur(${offset.blur}px)"`]),
  ];
}

/** The same properties at rest: opacity 1, scale 1, in place, sharp. */
function toRestVars(offset: OverlayMotionOffset): string[] {
  return [`opacity: 1`, ...(offset.scale === 1 ? [] : [`scale: 1`]), ...(offset.y === 0 ? [] : [`y: 0`]), ...(offset.blur === 0 ? [] : [`filter: "blur(0px)"`])];
}

/** The entrance tweens of a card (`target`): tweened from its offset, a wipe (its panel `wipe`), or nothing. */
function getMotionTweens(target: string, motion: OverlayEntranceMotion, start: number, wipe?: string): string[] {
  if (motion.kind === "none") return [];
  if (motion.kind === "wipe") {
    // The card grows from the left under the accent panel, then the panel slides off to the right over the card and its text.
    const halves = getWipeHalves(motion.seconds);
    return [
      `tl.fromTo("${target}", { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: ${halves.grow}, ease: "${motion.ease}", immediateRender: false }, ${start});`,
      `tl.fromTo("${wipe ?? `${target} .ov-wipe`}", { scaleX: 1 }, { scaleX: 0, duration: ${halves.reveal}, ease: "${motion.ease}", immediateRender: false }, ${r3(start + halves.grow)});`,
    ];
  }
  return [`tl.fromTo("${target}", { ${toTweenVars(motion.from).join(", ")} }, { ${[...toRestVars(motion.from), `duration: ${motion.seconds}`, `ease: "${motion.ease}"`, "immediateRender: false"].join(", ")} }, ${start});`];
}

/** The entrance tweens of a card by its named entrance (fade, slide, type, pop, rise, blur, wipe, or none). */
function getEntranceTweens(target: string, entrance: OverlayEntrance, start: number, look: { easing?: "smooth" | "snappy"; frame?: { width: number; height: number } } = {}): string[] {
  return getMotionTweens(target, getEntranceMotion(entrance, look.easing ?? "smooth", look.frame ?? { width: 1080, height: 1920 }), start);
}

/** The seconds an overlay's entrance takes, so what comes after it (an underline) starts once it is in. */
function getEntranceSeconds(entrance: OverlayEntrance | null, overlay: ResolvedOverlay, frame: { width: number; height: number }): number {
  if (entrance === null) return 0.45;
  const motion = getEntranceMotion(entrance, overlay.kind === "punch_in" ? "smooth" : (overlay.easing ?? "smooth"), frame);
  return motion.kind === "none" ? 0 : motion.seconds;
}

/** The exit tweens of an overlay's `target`, ending with its clip: its own (`own`, the kind's), tweened, wiped off, or none. */
function getExitTweens(target: string, overlay: Exclude<ResolvedOverlay, { kind: "punch_in" }>, frame: { width: number; height: number }, own: string): string[] {
  const motion = getExitMotion({ exit: overlay.exit ?? "auto", entrance: overlay.entrance, easing: overlay.easing ?? "smooth", frame });
  if (motion.kind === "none") return [];
  if (motion.kind === "own") return [own];
  const at = r3(overlay.end - motion.seconds);
  if (motion.kind === "wipe") return [`tl.to("${target}", { clipPath: "inset(0% 0% 0% 100%)", duration: ${motion.seconds}, ease: "${motion.ease}" }, ${at});`];
  return [`tl.to("${target}", { ${[...toTweenVars(motion.from), `duration: ${motion.seconds}`, `ease: "${motion.ease}"`].join(", ")} }, ${at});`];
}

/** The typing tweens: each character of `#<id>` shown at its time. */
function getTypingTweens(id: string, overlay: { start: number; typing: number | null }, length: number): string[] {
  if (overlay.typing === null || length === 0) return [];
  return [`tl.to("#${id} .ch", { opacity: 1, display: "inline", duration: 0.01, ease: "none", stagger: ${r3(1 / overlay.typing)} }, ${r3(overlay.start + OVERLAY_TYPING_DELAY)});`];
}

/** Shows each typed line's highlight mark (`#<id>m<line>`, a keyword's `#<id>t`) with the line's first letter. */
function getMarkRevealTweens(ids: readonly string[], overlay: { start: number; typing: number | null }, lines: readonly string[]): string[] {
  const { typing } = overlay;
  if (typing === null) return [];
  let offset = 0;
  return lines.flatMap((line, index) => {
    const at = overlay.start + OVERLAY_TYPING_DELAY + offset / typing;
    offset += [...line].length;
    const target = ids[index];
    return line === "" || target === undefined ? [] : [`tl.set("#${target}", { display: "inline" }, ${r3(at)});`];
  });
}

/** Each new kind's own entrance when the overlay names none. */
const DEFAULT_ENTRANCES = { hook_title: "slide", search_bar: "fade", place_card: "slide", counter: "fade", date_stamp: "fade" } as const;

interface MarkupContext {
  colors: OverlayColors;
  scale: number;
  locale: string;
  frame: { width: number; height: number };
}

/** A keyword or a lower third, entering as the soft pill (or by its own entrance). */
function addSideText(overlay: Extract<ResolvedOverlay, { kind: "keyword" | "lower_third" }>, id: string, context: MarkupContext, out: OverlayMarkup): void {
  const { box, fontSize, side } = overlay;
  const isCentred = overlay.kind === "keyword" && overlay.isCentred === true;
  const colors = getOverlayColors(overlay, context.colors);
  const cardStyle = getCardStyle(overlay, colors, context.scale);
  const dotStyle = overlay.colors.accent === undefined ? "" : ` style="background:${colors.accent}"`;
  const isTyped = overlay.typing !== null;
  const style = `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;font-size:${fontSize}px;align-items:${overlay.kind === "lower_third" ? "flex-end" : "flex-start"}`;
  const isDrop = overlay.kind === "keyword" && overlay.entrance === "drop";
  const text = isTyped ? toTypedHtml(overlay.text) : isDrop ? toDropHtml(overlay.text) : escapeHtml(overlay.text);
  const isMarked = overlay.kind === "keyword" && overlay.backdrop === "highlight";
  const wipe = overlay.entrance === "wipe" ? `<i class="ov-wipe" id="${id}w"></i>` : "";
  const underline = overlay.kind === "keyword" && overlay.underline === true ? `<i class="ov-ul" id="${id}u" style="${getUnderlineStyle(overlay)}"></i>` : "";
  const mark = isMarked ? ` class="ov-mark" style="background:${colors.background}"` : "";
  const body = `<div class="ov-card${isMarked ? " hl" : ""}"${cardStyle}>${wipe}${overlay.kind === "lower_third" ? `<i class="ov-dot" id="${id}d"${dotStyle}></i>` : ""}<span id="${id}t"${mark}>${text}</span>${underline}</div>`;
  out.html.push(clipDiv(overlay, id, `ov ov-${overlay.kind.replace("_", "-")}${isCentred ? " center" : side === "right" ? " right" : ""}${isTyped ? " ty" : ""}${underline === "" ? "" : " ul"}`, style, body));
  if (overlay.entrance !== null) {
    out.tweens.push(...getMotionTweens(`#${id} .ov-card`, getEntranceMotion(overlay.entrance, overlay.easing ?? "smooth", context.frame), overlay.start));
    out.tweens.push(...getTypingTweens(id, overlay, [...overlay.text].length));
    if (isMarked) out.tweens.push(...getMarkRevealTweens([`${id}t`], overlay, [[...overlay.text].join("")]));
    if (isDrop) out.tweens.push(...getDropTweens(`#${id}`, overlay.text, overlay.start, overlay.fontSize));
  } else {
    // The soft pill's entrance: the card rises from its foot, then its dot and its text settle in, eased out without
    // overshoot (RV-133 of an adopting app: nothing grows past its size).
    out.tweens.push(`tl.fromTo("#${id} .ov-card", { scale: 0.88, y: 18, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: "power3.out", immediateRender: false }, ${overlay.start});`);
    if (overlay.kind === "lower_third") {
      out.tweens.push(`tl.fromTo("#${id}d", { scale: 0 }, { scale: 1, duration: 0.35, ease: "power2.out", immediateRender: false }, ${r3(overlay.start + 0.25)});`);
      out.tweens.push(`tl.fromTo("#${id}t", { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out", immediateRender: false }, ${r3(overlay.start + 0.3)});`);
    }
  }
  if (underline !== "") {
    out.tweens.push(`tl.fromTo("#${id}u", { scaleX: 0 }, { scaleX: 1, duration: ${UNDERLINE_SECONDS}, ease: "power2.out", immediateRender: false }, ${r3(overlay.start + getEntranceSeconds(overlay.entrance, overlay, context.frame))});`);
  }
  out.tweens.push(
    ...getExitTweens(`#${id} .ov-card`, overlay, context.frame, `tl.to("#${id} .ov-card", { scale: 0.94, y: 14, opacity: 0, duration: ${EXIT_SECONDS}, ease: "power2.in" }, ${r3(overlay.end - EXIT_SECONDS)});`),
  );
}

/** The seconds a list's card takes to grow to its next point, and a point to come in. */
const LIST_GROW_SECONDS = 0.35;

/** A card's entrance at `start`: its named entrance, else the soft pill rising from its foot (eased out, no overshoot). */
function getListCardEntrance(overlay: Extract<ResolvedOverlay, { kind: "list" }>, target: string, start: number, context: MarkupContext): string[] {
  if (overlay.entrance !== null) return getMotionTweens(target, getEntranceMotion(overlay.entrance, overlay.easing ?? "smooth", context.frame), start);
  return [`tl.fromTo("${target}", { scale: 0.88, y: ${r3(18 * context.scale)}, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: "power3.out", immediateRender: false }, ${start});`];
}

/** A card's size and padding as inline CSS, in px. */
function getListCardSize(card: OverlayBox, pad: { x: number; y: number }): string {
  return `width:${card.width}px;height:${card.height}px;padding:${pad.y}px ${pad.x}px`;
}

/**
 * A list (RV-144 of an adopting app): a stack, one card whose first point comes in with it and which grows to each next
 * point as it comes in (eased out, no overshoot; centred lines in the frame's middle without a side), or chips, one card
 * per point in its final place of a centred row, each entering on its own second from the left. Every card leaves
 * together.
 */
function addList(overlay: Extract<ResolvedOverlay, { kind: "list" }>, id: string, context: MarkupContext, out: OverlayMarkup): void {
  const { box, fontSize } = overlay;
  const colors = getOverlayColors(overlay, context.colors);
  const own = getCardStyle(overlay, colors, context.scale).replace(/^ style="|"$/g, "");
  const pad = getOverlayPadding(overlay);
  const times = getListItemTimes(overlay);
  const cards = getListCardsByItem(overlay);
  const wipe = (suffix: string) => (overlay.entrance === "wipe" ? `<i class="ov-wipe" id="${id}w${suffix}"></i>` : "");
  const style = `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;font-size:${fontSize}px;align-items:flex-start`;
  if (overlay.chips !== undefined) {
    const chips = overlay.chips.map((chip, i) => {
      const place = `left:${chip.left - box.left}px;top:${chip.top - box.top}px;${getListCardSize(chip, pad)}${i === 0 ? "" : ";visibility:hidden"}${own === "" ? "" : `;${own}`}`;
      return `<div class="ov-card ov-chip" id="${id}c${i}" style="${place}">${wipe(String(i))}<span>${escapeHtml(overlay.items[i] as string)}</span></div>`;
    });
    out.html.push(clipDiv(overlay, id, "ov ov-list chips", style, chips.join("")));
    times.forEach((at, i) => {
      if (i > 0) out.tweens.push(`tl.set("#${id}c${i}", { visibility: "visible" }, ${at});`);
      out.tweens.push(...getListCardEntrance(overlay, `#${id}c${i}`, at, context));
    });
  } else {
    const isCentred = overlay.isCentred === true;
    const dotStyle = overlay.colors.accent === undefined ? "" : ` style="background:${colors.accent}"`;
    const first = times.filter((at) => at <= overlay.start).length - 1;
    const card = (cards[first] as OverlayBox[])[0] as OverlayBox;
    const items = overlay.items.map((item, i) => `<li id="${id}i${i}"${i > first ? ` style="opacity:0"` : ""}>${isCentred ? "" : `<i class="ov-dot"${dotStyle}></i>`}${escapeHtml(item)}</li>`);
    const cardStyle = `${getListCardSize(card, pad)}${own === "" ? "" : `;${own}`}`;
    const side = isCentred ? " center" : overlay.side === "right" ? " right" : "";
    out.html.push(clipDiv(overlay, id, `ov ov-list${side}`, style, `<ul class="ov-card grow${isCentred ? " cen" : ""}" style="${cardStyle}">${wipe("")}${items.join("")}</ul>`));
    out.tweens.push(...getListCardEntrance(overlay, `#${id} .ov-card`, overlay.start, context));
    // Each later point: the card eases to its new size as the point fades up into it.
    times.forEach((at, i) => {
      if (i <= first) return;
      const next = (cards[i] as OverlayBox[])[0] as OverlayBox;
      out.tweens.push(`tl.to("#${id} .ov-card", { width: ${next.width}, height: ${next.height}, duration: ${LIST_GROW_SECONDS}, ease: "power3.out" }, ${at});`);
      out.tweens.push(`tl.fromTo("#${id}i${i}", { opacity: 0, y: ${r3(14 * context.scale)} }, { opacity: 1, y: 0, duration: ${LIST_GROW_SECONDS}, ease: "power3.out", immediateRender: false }, ${at});`);
    });
  }
  out.tweens.push(
    ...getExitTweens(`#${id} .ov-card`, overlay, context.frame, `tl.to("#${id} .ov-card", { scale: 0.94, y: 14, opacity: 0, duration: ${EXIT_SECONDS}, ease: "power2.in" }, ${r3(overlay.end - EXIT_SECONDS)});`),
  );
}

/** Where a keyword's underline sits in its card: under the text, inside the card's padding. */
function getUnderlineStyle(overlay: Extract<ResolvedOverlay, { kind: "keyword" }>): string {
  const pad = overlay.padScale ?? 1;
  const x = r3(OVERLAY_PADDING_EM.x * pad);
  return `left:${x}em;right:${x}em;bottom:${r3(Math.max(0.04, OVERLAY_PADDING_EM.y * pad - UNDERLINE_EM.gap - UNDERLINE_EM.height))}em`;
}

type CardOverlay = Extract<ResolvedOverlay, { kind: "hook_title" | "search_bar" | "place_card" | "counter" | "date_stamp" }>;

/** The inner HTML of a card kind, and how many characters it types in. */
function getCardBody(overlay: CardOverlay, id: string, colors: OverlayColors, locale: string): { classes: string; body: string; typed: number } {
  const typedOrPlain = (text: string) => (overlay.typing === null ? escapeHtml(text) : toTypedHtml(text));
  if (overlay.kind === "hook_title") {
    const place = overlay.place === null ? "" : `<div class="ov-place" style="font-size:${overlay.placeFontSize}px">${getPinSvg(colors.accent)}<span>${escapeHtml(overlay.place)}</span></div>`;
    const isMarked = overlay.backdrop === "highlight";
    const draw = (line: string) => (overlay.entrance === "drop" ? toDropHtml(line) : typedOrPlain(line));
    const lines = overlay.lines.map((line, index) => `<div class="ov-line">${isMarked ? `<span class="ov-mark" id="${id}m${String(index)}" style="background:${colors.background}">${draw(line)}</span>` : draw(line)}</div>`).join("");
    return {
      classes: "ov-hook-title center",
      body: `<div class="ov-card ov-stack${overlay.align === "left" ? " left" : ""}${isMarked ? " hl" : ""}"__STYLE__>__WIPE__${place}${lines}</div>`,
      typed: overlay.lines.join("").length,
    };
  }
  if (overlay.kind === "place_card") {
    const subtitle = overlay.subtitle === null ? "" : `<div class="ov-sub" style="font-size:${overlay.subtitleFontSize}px">${escapeHtml(overlay.subtitle)}</div>`;
    const lines = overlay.lines.map((line) => `<div class="ov-line">${typedOrPlain(line)}</div>`).join("");
    const pinSize = getPlaceCardPinSize(overlay.fontSize);
    const pin = overlay.pin === undefined ? "" : `<div class="ov-pinrow" id="${id}p" style="height:${getPlaceCardPinRow(overlay.fontSize)}px">${getPinSvg(colors.accent).replace('class="ov-pin"', `class="ov-pin" style="width:${pinSize}px;height:${pinSize}px"`)}</div>`;
    const later = [overlay.pin === "drop" ? " pd" : "", overlay.pin !== undefined && overlay.typing === null ? " pl" : "", overlay.subtitleDelay === undefined || subtitle === "" ? "" : " sd"].join("");
    return { classes: `ov-place-card center${later}`, body: `<div class="ov-card ov-stack${overlay.align === "left" ? " left" : ""}"__STYLE__>__WIPE__${pin}${lines}${subtitle}</div>`, typed: overlay.lines.join("").length };
  }
  if (overlay.kind === "search_bar") {
    return { classes: "ov-search-bar center", body: `<div class="ov-card ov-search"__STYLE__>__WIPE__${getGlassSvg(colors.accent)}<span id="${id}t">${typedOrPlain(overlay.text)}</span></div>`, typed: [...overlay.text].length };
  }
  if (overlay.kind === "counter") {
    const unit = overlay.unit === null ? "" : `<span class="ov-unit" style="font-size:${overlay.unitFontSize}px">${escapeHtml(overlay.unit)}</span>`;
    return { classes: "ov-counter center", body: `<div class="ov-card"__STYLE__>__WIPE__<span id="${id}n">${escapeHtml(formatOverlayNumber(overlay.from, overlay.decimals, locale))}</span>${unit}</div>`, typed: 0 };
  }
  const place = overlay.place === null ? "" : `<div class="ov-sub" style="font-size:${overlay.placeFontSize}px">${escapeHtml(overlay.place)}</div>`;
  return { classes: `ov-date${overlay.side === "right" ? " right" : ""}`, body: `<div class="ov-card"__STYLE__>__WIPE__<span>${typedOrPlain(overlay.text)}</span>${place}</div>`, typed: [...overlay.text].length };
}

/** A hook title, a search bar, a place card, a counter or a date stamp. */
function addCard(overlay: CardOverlay, id: string, context: MarkupContext, out: OverlayMarkup): void {
  const colors = getOverlayColors(overlay, context.colors);
  const { box, fontSize } = overlay;
  const { classes, body, typed } = getCardBody(overlay, id, colors, context.locale);
  const style = `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;font-size:${fontSize}px;align-items:flex-start`;
  const wipe = overlay.entrance === "wipe" ? `<i class="ov-wipe" id="${id}w"></i>` : "";
  out.html.push(clipDiv(overlay, id, `ov ${classes}${overlay.typing === null ? "" : " ty"}`, style, body.replace("__STYLE__", getCardStyle(overlay, colors, context.scale)).replace("__WIPE__", wipe)));
  const entrance = overlay.entrance ?? (overlay.typing !== null ? "type" : DEFAULT_ENTRANCES[overlay.kind]);
  out.tweens.push(...getEntranceTweens(`#${id} .ov-card`, entrance, overlay.start, { ...(overlay.easing === undefined ? {} : { easing: overlay.easing }), frame: context.frame }));
  out.tweens.push(...getTypingTweens(id, overlay, typed));
  if (overlay.kind === "hook_title" && overlay.backdrop === "highlight") out.tweens.push(...getMarkRevealTweens(overlay.lines.map((_, index) => `${id}m${String(index)}`), overlay, overlay.lines));
  if (overlay.kind === "hook_title" && overlay.entrance === "drop") out.tweens.push(...getDropTweens(`#${id}`, overlay.lines.join(""), overlay.start, overlay.fontSize));
  if (overlay.kind === "place_card") out.tweens.push(...getPlaceCardPartTweens(overlay, id, context));
  if (overlay.kind === "counter") {
    const count = getCounterSeconds(overlay);
    const format = `new Intl.NumberFormat(${toScriptString(getScriptLocale(context.locale))}, { minimumFractionDigits: ${overlay.decimals}, maximumFractionDigits: ${overlay.decimals} })`;
    // The number eases up to its value; the timeline renders it on every seek, so each frame shows its own count.
    out.tweens.push(
      `(function () { const el = document.getElementById("${id}n"); const nf = ${format}; const n = { v: ${overlay.from} }; tl.fromTo(n, { v: ${overlay.from} }, { v: ${overlay.value}, duration: ${count.duration}, ease: "power2.out", immediateRender: false, onUpdate: () => { el.textContent = nf.format(n.v).replace(/[\\u00a0\\u202f]/g, " "); } }, ${count.start}); })();`,
    );
  }
  out.tweens.push(...getExitTweens(`#${id} .ov-card`, overlay, context.frame, `tl.to("#${id} .ov-card", { y: 10, opacity: 0, duration: ${EXIT_SECONDS}, ease: "power2.in" }, ${r3(overlay.end - EXIT_SECONDS)});`));
}

/**
 * A place card's parts that come in after its card: its pin dropping a little onto its place (eased out, no bounce),
 * its title once the pin is there, and its subtitle after its delay; the film seconds of each in `getPlaceCardTimes`.
 */
function getPlaceCardPartTweens(overlay: Extract<ResolvedOverlay, { kind: "place_card" }>, id: string, context: MarkupContext): string[] {
  const times = getPlaceCardTimes(overlay);
  const tweens: string[] = [];
  if (overlay.pin === "drop") {
    const drop = r3(getPlaceCardPinSize(overlay.fontSize) * PIN_DROP_SHARE);
    tweens.push(`tl.fromTo("#${id}p svg", { opacity: 0, y: -${drop} }, { opacity: 1, y: 0, duration: ${PIN_DROP_SECONDS}, ease: "power2.out", immediateRender: false }, ${overlay.start});`);
  }
  if (overlay.pin !== undefined && overlay.typing === null) {
    tweens.push(`tl.fromTo("#${id} .ov-line", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out", immediateRender: false }, ${times.title});`);
  }
  if (times.subtitle !== null && overlay.subtitleDelay !== undefined) {
    tweens.push(`tl.fromTo("#${id} .ov-sub", { opacity: 0, y: ${r3(8 * context.scale)} }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, ${times.subtitle});`);
  }
  return tweens;
}

/** When a place card's pin, title and subtitle come in, in film seconds: pin first, then the title, then the subtitle. */
export function getPlaceCardTimes(overlay: Pick<Extract<ResolvedOverlay, { kind: "place_card" }>, "start" | "pin" | "typing" | "subtitle" | "subtitleDelay">): {
  pin: number | null;
  title: number;
  subtitle: number | null;
} {
  const title = overlay.pin !== undefined && overlay.typing === null ? r3(overlay.start + PIN_TITLE_LEAD) : overlay.start;
  return { pin: overlay.pin === undefined ? null : overlay.start, title, subtitle: overlay.subtitle === null ? null : r3(title + (overlay.subtitleDelay ?? 0)) };
}

/** The brand's locale as a canonical BCP 47 tag (letters, digits and dashes only), `en-US` when it is not one. */
export function getScriptLocale(locale: string | undefined): string {
  try {
    return Intl.getCanonicalLocales(locale ?? "en-US")[0] ?? "en-US";
  } catch {
    return "en-US";
  }
}

/** A string as a script literal that cannot close the `<script>` element it sits in. */
function toScriptString(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * A note: its paper (the torn outline of `getNotePaperPoints`) turned by its tilt about its middle; a card's words
 * handwritten and shown each on its said second, the card there (empty) just before; a strip growing in from
 * `NOTE_GROW_FROM_SCALE` (eased out, never past its size) and typing its capitals; the tick drawn after the last word.
 */
function addNote(overlay: Extract<ResolvedOverlay, { kind: "note" }>, id: string, context: MarkupContext, out: OverlayMarkup): void {
  const { box, fontSize } = overlay;
  const colors = getNoteColors(overlay);
  const isStrip = overlay.noteStyle === "strip";
  const local = (point: { x: number; y: number }) => `${r3(point.x - box.left)},${r3(point.y - box.top)}`;
  const paper = `<svg class="paper" viewBox="0 0 ${box.width} ${box.height}"><polygon points="${getNotePaperPoints(overlay).map(local).join(" ")}" fill="${colors.paper}"/></svg>`;
  const text = getNoteTextBox(overlay);
  const lineHeight = fontSize * NOTE_LINE_HEIGHT;
  const place = (index: number) => `left:${r3(text.left - box.left)}px;top:${r3(text.top - box.top + index * lineHeight)}px`;
  let word = 0;
  const lines = isStrip
    ? overlay.lines.map((line, index) => `<div class="nt" style="${place(index)}">${toTypedHtml(line)}</div>`)
    : getNoteWordsByLine(overlay).map((words, index) => `<div class="nt" style="${place(index)}">${words.map((entry) => `<span class="nw" id="${id}w${word++}">${escapeHtml(entry.text)}</span>`).join(" ")}</div>`);
  const tick = overlay.tickAt === null ? "" : `<svg class="tick" viewBox="0 0 ${box.width} ${box.height}"><polyline id="${id}k" points="${getNoteTickPoints(overlay).map(local).join(" ")}" fill="none" stroke="${colors.tick}" stroke-width="${r3(fontSize * 0.12)}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`;
  const style = `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;font-size:${fontSize}px;color:${colors.ink};transform:rotate(${r3(-overlay.tilt)}deg)`;
  out.html.push(clipDiv(overlay, id, `ov ov-note ${isStrip ? "ov-strip ty" : "ov-hand"}`, style, `<div class="nb">${paper}${lines.join("")}${tick}</div>`));
  const look = { ...(overlay.easing === undefined ? {} : { easing: overlay.easing }), frame: context.frame };
  if (isStrip && overlay.entrance === null) {
    out.tweens.push(`tl.fromTo("#${id} .nb", { scale: ${NOTE_GROW_FROM_SCALE} }, { scale: 1, duration: ${NOTE_GROW_SECONDS}, ease: "power2.out", immediateRender: false }, ${overlay.start});`);
  } else out.tweens.push(...getEntranceTweens(`#${id} .nb`, overlay.entrance ?? "none", overlay.start, look));
  if (isStrip) out.tweens.push(...getTypingTweens(id, overlay, overlay.lines.join("").length));
  else {
    getNoteWordsByLine(overlay)
      .flat()
      .forEach((entry, index) => out.tweens.push(`tl.fromTo("#${id}w${index}", { opacity: 0 }, { opacity: 1, duration: 0.1, ease: "none", immediateRender: false }, ${entry.at});`));
  }
  if (overlay.tickAt !== null) {
    out.tweens.push(`tl.fromTo("#${id}k", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: ${NOTE_TICK_SECONDS}, ease: "power2.out", immediateRender: false }, ${overlay.tickAt});`);
  }
  out.tweens.push(...getExitTweens(`#${id} .nb`, overlay, context.frame, `tl.to("#${id} .nb", { opacity: 0, duration: ${EXIT_SECONDS}, ease: "power2.in" }, ${r3(overlay.end - EXIT_SECONDS)});`));
}

/** An end word: one big handwritten line, no card, its letters dropping in (or its own entrance), fading out at the end. */
function addEndWord(overlay: Extract<ResolvedOverlay, { kind: "end_word" }>, id: string, context: MarkupContext, out: OverlayMarkup): void {
  const { box, fontSize } = overlay;
  const entrance = overlay.entrance ?? "drop";
  const text = entrance === "drop" ? toDropHtml(overlay.text) : escapeHtml(overlay.text);
  const style = `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;font-size:${fontSize}px;justify-content:center;align-items:flex-start`;
  out.html.push(clipDiv(overlay, id, "ov ov-end-word", style, `<div class="ov-endword ov-hand nb" style="color:${overlay.colors.text ?? "#ffffff"}">${text}</div>`));
  if (entrance === "drop") out.tweens.push(...getDropTweens(`#${id}`, overlay.text, overlay.start, fontSize));
  else out.tweens.push(...getEntranceTweens(`#${id} .nb`, entrance, overlay.start, { ...(overlay.easing === undefined ? {} : { easing: overlay.easing }), frame: context.frame }));
  out.tweens.push(...getExitTweens(`#${id} .nb`, overlay, context.frame, `tl.to("#${id} .nb", { opacity: 0, duration: ${EXIT_SECONDS}, ease: "power2.in" }, ${r3(overlay.end - EXIT_SECONDS)});`));
}

/** An overlay's clip: shown for its own span. */
function clipDiv(overlay: ResolvedOverlay, id: string, classes: string, style: string, body: string): string {
  return `<div id="${id}" class="clip ${classes}" data-start="${overlay.start}" data-duration="${r3(overlay.end - overlay.start)}" style="${style}">${body}</div>`;
}

/** An arrow drawn on from its tail, or a highlight's marker drawn round its target (or faded in, or simply there). */
function addMark(overlay: Extract<ResolvedOverlay, { kind: "arrow" | "highlight" }>, id: string, context: MarkupContext, out: OverlayMarkup): void {
  const { frame, scale } = context;
  const { accent } = getOverlayColors(overlay, context.colors);
  const stroke = r3(STROKE_WIDTH * scale);
  const view = `viewBox="0 0 ${frame.width} ${frame.height}"`;
  const isDrawn = overlay.entrance === null;
  const dash = isDrawn ? ` pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"` : "";
  if (overlay.kind === "arrow") {
    const paths = getArrowPaths(overlay, scale);
    const body = `<svg class="ov-svg" ${view}><path id="${id}c" d="${paths.curve}" fill="none" stroke="${accent}" stroke-width="${stroke}" stroke-linecap="round"${dash}/><path id="${id}h" d="${paths.head}" fill="none" stroke="${accent}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"${isDrawn ? ` opacity="0"` : ""}/></svg>`;
    out.html.push(clipDiv(overlay, id, "ov ov-arrow", "inset:0", body));
    if (isDrawn) {
      // Drawn on from the tail; the head arrives as the stroke reaches the point.
      out.tweens.push(`tl.fromTo("#${id}c", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.45, ease: "power2.out", immediateRender: false }, ${overlay.start});`);
      out.tweens.push(`tl.fromTo("#${id}h", { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "none", immediateRender: false }, ${r3(overlay.start + 0.38)});`);
    }
  } else {
    const { rect } = overlay;
    const radius = r3(18 * scale);
    const body = `<svg class="ov-svg" ${view}><rect x="${rect.left}" y="${rect.top}" width="${rect.width}" height="${rect.height}" rx="${radius}" fill="${accent}" fill-opacity="0.18" stroke="none" id="${id}f"${isDrawn ? ` opacity="0"` : ""}/><rect id="${id}s" x="${rect.left}" y="${rect.top}" width="${rect.width}" height="${rect.height}" rx="${radius}" fill="none" stroke="${accent}" stroke-width="${stroke}"${dash}/></svg>`;
    out.html.push(clipDiv(overlay, id, "ov ov-highlight", "inset:0", body));
    if (isDrawn) {
      // The marker's stroke drawn round its target, the tint settling in behind it.
      out.tweens.push(`tl.fromTo("#${id}s", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.5, ease: "power2.inOut", immediateRender: false }, ${overlay.start});`);
      out.tweens.push(`tl.fromTo("#${id}f", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "none", immediateRender: false }, ${r3(overlay.start + 0.3)});`);
    }
  }
  if (overlay.entrance === "fade") out.tweens.push(...getEntranceTweens(`#${id} .ov-svg`, "fade", overlay.start, { ...(overlay.easing === undefined ? {} : { easing: overlay.easing }), frame }));
  out.tweens.push(...getExitTweens(`#${id} .ov-svg`, overlay, frame, `tl.to("#${id} .ov-svg", { opacity: 0, duration: ${EXIT_SECONDS}, ease: "power2.in" }, ${r3(overlay.end - EXIT_SECONDS)});`));
}

/**
 * The drawn overlays' markup, CSS and tweens (a `punch_in` draws nothing: `composeFootage` zooms the picture). Each
 * overlay is a clip shown for its own span, entering at its start and leaving over its last 0.3 s. Titles, numbers and
 * keywords are drawn in `headingFont`, labels, lists, the search query and the stamp in `interfaceFont` (the body font
 * without one); a counter's number is grouped as `locale` writes numbers.
 */
export function getOverlayMarkup(
  overlays: readonly ResolvedOverlay[],
  input: { colors: OverlayColors; headingFont: string; interfaceFont?: string; locale?: string; frame: { width: number; height: number }; style?: BrandStyle; handFontSrc?: string },
): OverlayMarkup {
  const drawn = overlays.filter((overlay): overlay is Exclude<ResolvedOverlay, { kind: "punch_in" }> => overlay.kind !== "punch_in");
  if (drawn.length === 0) return { html: [], css: [], tweens: [] };
  const context: MarkupContext = { colors: input.colors, scale: input.frame.width / 1080, locale: input.locale ?? "en-US", frame: input.frame };
  const css = [...getHandFontCss(drawn, input.handFontSrc ?? HAND_FONT.asset), ...getOverlayCss(input.colors, { heading: input.headingFont, interface: input.interfaceFont ?? "inherit" }, input.style, context.scale)];
  const out: OverlayMarkup = { html: [], css, tweens: [] };
  for (const overlay of drawn) {
    const id = `ov${overlay.index}`;
    if (overlay.kind === "list") addList(overlay, id, context, out);
    else if (overlay.kind === "keyword" || overlay.kind === "lower_third") addSideText(overlay, id, context, out);
    else if (overlay.kind === "arrow" || overlay.kind === "highlight") addMark(overlay, id, context, out);
    else if (overlay.kind === "note") addNote(overlay, id, context, out);
    else if (overlay.kind === "end_word") addEndWord(overlay, id, context, out);
    else addCard(overlay, id, context, out);
  }
  return out;
}
