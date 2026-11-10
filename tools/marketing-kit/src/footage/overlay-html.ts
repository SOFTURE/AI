import type { BrandColors } from "../config/colors.js";
import { escapeHtml } from "../compose/html.js";
import { getCornerRadiusCss, getStyleBorderCss, getStyleShadowCss, type BrandStyle } from "./brand-style.js";
import type { OverlayEntrance } from "./overlay-schema.js";
import { OVERLAY_LINE_HEIGHT, OVERLAY_LIST_LINE_HEIGHT, OVERLAY_PADDING_EM, OVERLAY_TITLE_LINE_HEIGHT, SEARCH_BAR_PADDING_EM, formatOverlayNumber, type ResolvedOverlay } from "./overlays.js";

/**
 * The render's overlays (issue #1200): HTML, CSS and GSAP tweens for the HyperFrames composition, every look in the
 * brand's colours and fonts (or the overlay's own colours) and every element a local clip (no network at render time).
 *
 * The motion is adapted from HyperFrames registry blocks (Apache-2.0, https://github.com/heygen-com/hyperframes):
 * `lt-soft-pill` (the lower third's scale-pop pill, dot and settling text), `marker-highlight` (the stroke drawn over
 * its target), `hw-arrow` (the drawn-on arrow whose head arrives last) and `push-in` (the eased camera push, in
 * `composeFootage`). They are rewritten for the kit's frame, timeline and brand tokens: see the package's NOTICE. The
 * entrances (`fade`, `slide`, `type`, `none`), the typed search field, the counting number and the drawn pin are the
 * kit's own, eased without overshoot.
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
    `.ov-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}`,
    `.ov-search,.ov-counter .ov-card,.ov-date .ov-card,.ov-place,.ov-sub,.ov-line{white-space:nowrap}`,
    `.ov-stack{flex-direction:column;gap:0;text-align:center;transform-origin:50% 0%}`,
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
    // The brand's style (after the kinds' own rules, so it wins over them; the search bar stays a pill).
    ...(style === undefined
      ? []
      : [
          `.ov-card{border-radius:${getCornerRadiusCss(style.cornerRadius, scale)};box-shadow:${getStyleShadowCss(style, scale)};border:${getStyleBorderCss(style, colors.accent, scale)}}`,
          `.ov-search{border-radius:999px}`,
          ...(style.border === "none" ? [] : [`.ov-keyword .ov-card{border-bottom:.12em solid ${colors.accent}}`]),
        ]),
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
  const parts = [own.card === undefined ? "" : `background:${colors.background}`, own.text === undefined ? "" : `color:${colors.foreground}`];
  if (overlay.cornerRadius !== null) parts.push(`border-radius:${getCornerRadiusCss(overlay.cornerRadius, scale)}`);
  if (overlay.kind === "keyword" && own.accent !== undefined) parts.push(`border-bottom-color:${colors.accent}`);
  const style = parts.filter((part) => part !== "").join(";");
  return style === "" ? "" : ` style="${style}"`;
}

/** The entrance tweens of a card: fade, slide, a typed card's fade, or nothing. */
function getEntranceTweens(target: string, entrance: OverlayEntrance, start: number): string[] {
  if (entrance === "none") return [];
  if (entrance === "slide") return [`tl.fromTo("${target}", { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", immediateRender: false }, ${start});`];
  const duration = entrance === "type" ? 0.25 : 0.4;
  return [`tl.fromTo("${target}", { opacity: 0 }, { opacity: 1, duration: ${duration}, ease: "power2.out", immediateRender: false }, ${start});`];
}

/** The typing tweens: each character of `#<id>` shown at its time. */
function getTypingTweens(id: string, overlay: { start: number; typing: number | null }, length: number): string[] {
  if (overlay.typing === null || length === 0) return [];
  return [`tl.to("#${id} .ch", { opacity: 1, duration: 0.01, ease: "none", stagger: ${r3(1 / overlay.typing)} }, ${r3(overlay.start + OVERLAY_TYPING_DELAY)});`];
}

/** Each new kind's own entrance when the overlay names none. */
const DEFAULT_ENTRANCES = { hook_title: "slide", search_bar: "fade", place_card: "slide", counter: "fade", date_stamp: "fade" } as const;

interface MarkupContext {
  colors: OverlayColors;
  scale: number;
  locale: string;
  frame: { width: number; height: number };
}

/** A keyword, a lower third or a list, entering as the soft pill (or by its own entrance). */
function addSideText(overlay: Extract<ResolvedOverlay, { kind: "keyword" | "lower_third" | "list" }>, id: string, context: MarkupContext, out: OverlayMarkup): void {
  const { box, fontSize, side } = overlay;
  const colors = getOverlayColors(overlay, context.colors);
  const cardStyle = getCardStyle(overlay, colors, context.scale);
  const dotStyle = overlay.colors.accent === undefined ? "" : ` style="background:${colors.accent}"`;
  const isTyped = overlay.typing !== null && overlay.kind !== "list";
  const style = `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;font-size:${fontSize}px;align-items:${overlay.kind === "lower_third" ? "flex-end" : "flex-start"}`;
  const text = overlay.kind === "list" ? "" : isTyped ? toTypedHtml(overlay.text) : escapeHtml(overlay.text);
  const body =
    overlay.kind === "list"
      ? `<ul class="ov-card"${cardStyle}>${overlay.items.map((item, i) => `<li id="${id}i${i}"><i class="ov-dot"${dotStyle}></i>${escapeHtml(item)}</li>`).join("")}</ul>`
      : `<div class="ov-card"${cardStyle}>${overlay.kind === "lower_third" ? `<i class="ov-dot" id="${id}d"${dotStyle}></i>` : ""}<span id="${id}t">${text}</span></div>`;
  out.html.push(clipDiv(overlay, id, `ov ov-${overlay.kind.replace("_", "-")}${side === "right" ? " right" : ""}${isTyped ? " ty" : ""}`, style, body));
  if (overlay.entrance !== null) {
    out.tweens.push(...getEntranceTweens(`#${id} .ov-card`, overlay.entrance, overlay.start));
    if (overlay.kind !== "list") out.tweens.push(...getTypingTweens(id, overlay, [...overlay.text].length));
  } else {
    // The soft pill's entrance: the card rises from its foot, then its dot and its text settle in.
    out.tweens.push(`tl.fromTo("#${id} .ov-card", { scale: 0.88, y: 18, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: "back.out(1.7)", immediateRender: false }, ${overlay.start});`);
    if (overlay.kind === "lower_third") {
      out.tweens.push(`tl.fromTo("#${id}d", { scale: 0 }, { scale: 1, duration: 0.35, ease: "back.out(3)", immediateRender: false }, ${r3(overlay.start + 0.25)});`);
      out.tweens.push(`tl.fromTo("#${id}t", { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out", immediateRender: false }, ${r3(overlay.start + 0.3)});`);
    }
    if (overlay.kind === "list") {
      overlay.items.forEach((_item, i) => {
        out.tweens.push(`tl.fromTo("#${id}i${i}", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out", immediateRender: false }, ${r3(overlay.start + 0.2 + 0.12 * i)});`);
      });
    }
  }
  out.tweens.push(`tl.to("#${id} .ov-card", { scale: 0.94, y: 14, opacity: 0, duration: ${EXIT_SECONDS}, ease: "power2.in" }, ${r3(overlay.end - EXIT_SECONDS)});`);
}

type CardOverlay = Extract<ResolvedOverlay, { kind: "hook_title" | "search_bar" | "place_card" | "counter" | "date_stamp" }>;

/** The inner HTML of a card kind, and how many characters it types in. */
function getCardBody(overlay: CardOverlay, id: string, colors: OverlayColors, locale: string): { classes: string; body: string; typed: number } {
  const typedOrPlain = (text: string) => (overlay.typing === null ? escapeHtml(text) : toTypedHtml(text));
  if (overlay.kind === "hook_title") {
    const place = overlay.place === null ? "" : `<div class="ov-place" style="font-size:${overlay.placeFontSize}px">${getPinSvg(colors.accent)}<span>${escapeHtml(overlay.place)}</span></div>`;
    const lines = overlay.lines.map((line) => `<div class="ov-line">${typedOrPlain(line)}</div>`).join("");
    return { classes: "ov-hook-title center", body: `<div class="ov-card ov-stack"__STYLE__>${place}${lines}</div>`, typed: overlay.lines.join("").length };
  }
  if (overlay.kind === "place_card") {
    const subtitle = overlay.subtitle === null ? "" : `<div class="ov-sub" style="font-size:${overlay.subtitleFontSize}px">${escapeHtml(overlay.subtitle)}</div>`;
    const lines = overlay.lines.map((line) => `<div class="ov-line">${typedOrPlain(line)}</div>`).join("");
    return { classes: "ov-place-card center", body: `<div class="ov-card ov-stack"__STYLE__>${lines}${subtitle}</div>`, typed: overlay.lines.join("").length };
  }
  if (overlay.kind === "search_bar") {
    return { classes: "ov-search-bar center", body: `<div class="ov-card ov-search"__STYLE__>${getGlassSvg(colors.accent)}<span id="${id}t">${typedOrPlain(overlay.text)}</span></div>`, typed: [...overlay.text].length };
  }
  if (overlay.kind === "counter") {
    const unit = overlay.unit === null ? "" : `<span class="ov-unit" style="font-size:${overlay.unitFontSize}px">${escapeHtml(overlay.unit)}</span>`;
    return { classes: "ov-counter center", body: `<div class="ov-card"__STYLE__><span id="${id}n">${escapeHtml(formatOverlayNumber(overlay.from, overlay.decimals, locale))}</span>${unit}</div>`, typed: 0 };
  }
  const place = overlay.place === null ? "" : `<div class="ov-sub" style="font-size:${overlay.placeFontSize}px">${escapeHtml(overlay.place)}</div>`;
  return { classes: `ov-date${overlay.side === "right" ? " right" : ""}`, body: `<div class="ov-card"__STYLE__><span>${typedOrPlain(overlay.text)}</span>${place}</div>`, typed: [...overlay.text].length };
}

/** A hook title, a search bar, a place card, a counter or a date stamp. */
function addCard(overlay: CardOverlay, id: string, context: MarkupContext, out: OverlayMarkup): void {
  const colors = getOverlayColors(overlay, context.colors);
  const { box, fontSize } = overlay;
  const { classes, body, typed } = getCardBody(overlay, id, colors, context.locale);
  const style = `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;font-size:${fontSize}px;align-items:flex-start`;
  out.html.push(clipDiv(overlay, id, `ov ${classes}${overlay.typing === null ? "" : " ty"}`, style, body.replace("__STYLE__", getCardStyle(overlay, colors, context.scale))));
  const entrance = overlay.entrance ?? (overlay.typing !== null ? "type" : DEFAULT_ENTRANCES[overlay.kind]);
  out.tweens.push(...getEntranceTweens(`#${id} .ov-card`, entrance, overlay.start));
  out.tweens.push(...getTypingTweens(id, overlay, typed));
  if (overlay.kind === "counter") {
    const count = getCounterSeconds(overlay);
    const format = `new Intl.NumberFormat(${toScriptString(getScriptLocale(context.locale))}, { minimumFractionDigits: ${overlay.decimals}, maximumFractionDigits: ${overlay.decimals} })`;
    // The number eases up to its value; the timeline renders it on every seek, so each frame shows its own count.
    out.tweens.push(
      `(function () { const el = document.getElementById("${id}n"); const nf = ${format}; const n = { v: ${overlay.from} }; tl.fromTo(n, { v: ${overlay.from} }, { v: ${overlay.value}, duration: ${count.duration}, ease: "power2.out", immediateRender: false, onUpdate: () => { el.textContent = nf.format(n.v).replace(/[\\u00a0\\u202f]/g, " "); } }, ${count.start}); })();`,
    );
  }
  out.tweens.push(`tl.to("#${id} .ov-card", { y: 10, opacity: 0, duration: ${EXIT_SECONDS}, ease: "power2.in" }, ${r3(overlay.end - EXIT_SECONDS)});`);
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
  if (overlay.entrance === "fade") out.tweens.push(...getEntranceTweens(`#${id} .ov-svg`, "fade", overlay.start));
  out.tweens.push(`tl.to("#${id} .ov-svg", { opacity: 0, duration: ${EXIT_SECONDS}, ease: "power2.in" }, ${r3(overlay.end - EXIT_SECONDS)});`);
}

/**
 * The drawn overlays' markup, CSS and tweens (a `punch_in` draws nothing: `composeFootage` zooms the picture). Each
 * overlay is a clip shown for its own span, entering at its start and leaving over its last 0.3 s. Titles, numbers and
 * keywords are drawn in `headingFont`, labels, lists, the search query and the stamp in `interfaceFont` (the body font
 * without one); a counter's number is grouped as `locale` writes numbers.
 */
export function getOverlayMarkup(
  overlays: readonly ResolvedOverlay[],
  input: { colors: OverlayColors; headingFont: string; interfaceFont?: string; locale?: string; frame: { width: number; height: number }; style?: BrandStyle },
): OverlayMarkup {
  const drawn = overlays.filter((overlay): overlay is Exclude<ResolvedOverlay, { kind: "punch_in" }> => overlay.kind !== "punch_in");
  if (drawn.length === 0) return { html: [], css: [], tweens: [] };
  const context: MarkupContext = { colors: input.colors, scale: input.frame.width / 1080, locale: input.locale ?? "en-US", frame: input.frame };
  const out: OverlayMarkup = { html: [], css: getOverlayCss(input.colors, { heading: input.headingFont, interface: input.interfaceFont ?? "inherit" }, input.style, context.scale), tweens: [] };
  for (const overlay of drawn) {
    const id = `ov${overlay.index}`;
    if (overlay.kind === "keyword" || overlay.kind === "lower_third" || overlay.kind === "list") addSideText(overlay, id, context, out);
    else if (overlay.kind === "arrow" || overlay.kind === "highlight") addMark(overlay, id, context, out);
    else addCard(overlay, id, context, out);
  }
  return out;
}
