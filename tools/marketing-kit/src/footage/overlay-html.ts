import type { BrandColors } from "../config/colors.js";
import { escapeHtml } from "../compose/html.js";
import { OVERLAY_LINE_HEIGHT, OVERLAY_LIST_LINE_HEIGHT, OVERLAY_PADDING_EM, type ResolvedOverlay } from "./overlays.js";

/**
 * The render's overlays (issue #1200): HTML, CSS and GSAP tweens for the HyperFrames composition, every look in the
 * brand's colours and fonts and every element a local clip (no network at render time).
 *
 * The motion is adapted from HyperFrames registry blocks (Apache-2.0, https://github.com/heygen-com/hyperframes):
 * `lt-soft-pill` (the lower third's scale-pop pill, dot and settling text), `marker-highlight` (the stroke drawn over
 * its target), `hw-arrow` (the drawn-on arrow whose head arrives last) and `push-in` (the eased camera push, in
 * `composeFootage`). They are rewritten for the kit's frame, timeline and brand tokens: see the package's NOTICE.
 */

/** The seconds an overlay takes to leave, ending with its clip. */
const EXIT_SECONDS = 0.3;
/** An arrow's or a highlight's stroke, in px of a 1080 px wide frame. */
const STROKE_WIDTH = 10;
/** The arrow head's length, in px of a 1080 px wide frame. */
const ARROW_HEAD = 46;

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

export interface OverlayMarkup {
  html: string[];
  css: string[];
  tweens: string[];
}

/** The brand's colours an overlay paints with: its card, its text, its accent (the dot, the arrow, the marker). */
export type OverlayColors = Pick<BrandColors, "background" | "foreground" | "accent">;

/** The CSS every overlay kind shares, written once when the film has any drawn overlay. */
function getOverlayCss(colors: OverlayColors, headingFont: string): string[] {
  return [
    `.ov{position:absolute;display:flex;pointer-events:none}`,
    `.ov.right{justify-content:flex-end}`,
    `.ov-card{display:flex;align-items:center;gap:.45em;padding:${OVERLAY_PADDING_EM.y}em ${OVERLAY_PADDING_EM.x}em;border-radius:.42em;background:${colors.background};color:${colors.foreground};box-shadow:0 14px 44px rgba(0,0,0,.35);line-height:${OVERLAY_LINE_HEIGHT};font-weight:700;letter-spacing:-.015em;max-width:100%;overflow-wrap:anywhere;transform-origin:0% 100%}`,
    `.ov.right .ov-card{transform-origin:100% 100%}`,
    `.ov-keyword .ov-card{font-family:${headingFont};border-bottom:.12em solid ${colors.accent}}`,
    `.ov-dot{flex:none;width:.36em;height:.36em;border-radius:50%;background:${colors.accent}}`,
    `.ov-list .ov-card{flex-direction:column;align-items:flex-start;gap:0;line-height:${OVERLAY_LIST_LINE_HEIGHT};font-weight:650}`,
    `.ov-list li{display:flex;align-items:center;gap:.45em;list-style:none}`,
    `.ov-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}`,
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

/**
 * The drawn overlays' markup, CSS and tweens (a `punch_in` draws nothing: `composeFootage` zooms the picture). Each
 * overlay is a clip shown for its own span, entering at its start and leaving over its last 0.3 s.
 */
export function getOverlayMarkup(overlays: readonly ResolvedOverlay[], input: { colors: OverlayColors; headingFont: string; frame: { width: number; height: number } }): OverlayMarkup {
  const drawn = overlays.filter((overlay) => overlay.kind !== "punch_in");
  if (drawn.length === 0) return { html: [], css: [], tweens: [] };
  const { colors, frame } = input;
  const scale = frame.width / 1080;
  const stroke = r3(STROKE_WIDTH * scale);
  const html: string[] = [];
  const tweens: string[] = [];
  for (const overlay of drawn) {
    const id = `ov${overlay.index}`;
    const duration = r3(overlay.end - overlay.start);
    const exitAt = r3(overlay.end - EXIT_SECONDS);
    const clip = (classes: string, style: string, body: string) =>
      `<div id="${id}" class="clip ${classes}" data-start="${overlay.start}" data-duration="${duration}" style="${style}">${body}</div>`;
    if (overlay.kind === "keyword" || overlay.kind === "lower_third" || overlay.kind === "list") {
      const { box, fontSize, side } = overlay;
      const style = `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;font-size:${fontSize}px;align-items:${overlay.kind === "lower_third" ? "flex-end" : "flex-start"}`;
      const body =
        overlay.kind === "list"
          ? `<ul class="ov-card">${overlay.items.map((item, i) => `<li id="${id}i${i}"><i class="ov-dot"></i>${escapeHtml(item)}</li>`).join("")}</ul>`
          : `<div class="ov-card">${overlay.kind === "lower_third" ? `<i class="ov-dot" id="${id}d"></i>` : ""}<span id="${id}t">${escapeHtml(overlay.text)}</span></div>`;
      html.push(clip(`ov ov-${overlay.kind.replace("_", "-")}${side === "right" ? " right" : ""}`, style, body));
      // The soft pill's entrance: the card pops up from its foot, then its dot and its text settle in.
      tweens.push(`tl.fromTo("#${id} .ov-card", { scale: 0.88, y: 18, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: "back.out(1.7)", immediateRender: false }, ${overlay.start});`);
      if (overlay.kind === "lower_third") {
        tweens.push(`tl.fromTo("#${id}d", { scale: 0 }, { scale: 1, duration: 0.35, ease: "back.out(3)", immediateRender: false }, ${r3(overlay.start + 0.25)});`);
        tweens.push(`tl.fromTo("#${id}t", { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out", immediateRender: false }, ${r3(overlay.start + 0.3)});`);
      }
      if (overlay.kind === "list") {
        overlay.items.forEach((_item, i) => {
          tweens.push(`tl.fromTo("#${id}i${i}", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out", immediateRender: false }, ${r3(overlay.start + 0.2 + 0.12 * i)});`);
        });
      }
      tweens.push(`tl.to("#${id} .ov-card", { scale: 0.94, y: 14, opacity: 0, duration: ${EXIT_SECONDS}, ease: "power2.in" }, ${exitAt});`);
      continue;
    }
    const view = `viewBox="0 0 ${frame.width} ${frame.height}"`;
    if (overlay.kind === "arrow") {
      const paths = getArrowPaths(overlay, scale);
      const body = `<svg class="ov-svg" ${view}><path id="${id}c" d="${paths.curve}" fill="none" stroke="${colors.accent}" stroke-width="${stroke}" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><path id="${id}h" d="${paths.head}" fill="none" stroke="${colors.accent}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" opacity="0"/></svg>`;
      html.push(clip("ov ov-arrow", "inset:0", body));
      // Drawn on from the tail; the head arrives as the stroke reaches the point.
      tweens.push(`tl.fromTo("#${id}c", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.45, ease: "power2.out", immediateRender: false }, ${overlay.start});`);
      tweens.push(`tl.fromTo("#${id}h", { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "none", immediateRender: false }, ${r3(overlay.start + 0.38)});`);
    } else if (overlay.kind === "highlight") {
      const { rect } = overlay;
      const radius = r3(18 * scale);
      const body = `<svg class="ov-svg" ${view}><rect x="${rect.left}" y="${rect.top}" width="${rect.width}" height="${rect.height}" rx="${radius}" fill="${colors.accent}" fill-opacity="0.18" stroke="none" id="${id}f" opacity="0"/><rect id="${id}s" x="${rect.left}" y="${rect.top}" width="${rect.width}" height="${rect.height}" rx="${radius}" fill="none" stroke="${colors.accent}" stroke-width="${stroke}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`;
      html.push(clip("ov ov-highlight", "inset:0", body));
      // The marker's stroke drawn round its target, the tint settling in behind it.
      tweens.push(`tl.fromTo("#${id}s", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.5, ease: "power2.inOut", immediateRender: false }, ${overlay.start});`);
      tweens.push(`tl.fromTo("#${id}f", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "none", immediateRender: false }, ${r3(overlay.start + 0.3)});`);
    }
    tweens.push(`tl.to("#${id} .ov-svg", { opacity: 0, duration: ${EXIT_SECONDS}, ease: "power2.in" }, ${exitAt});`);
  }
  return { html, css: getOverlayCss(colors, input.headingFont), tweens };
}
