import type { BrandColors } from "../config/colors.js";
import type { SfxEvent } from "../config/schema.js";
import type { ComposeFont } from "../compose/compose.js";
import { escapeHtml, fontFaces, fontStack } from "../compose/html.js";
import { captionChunks, type CaptionLayout } from "../compose/timeline.js";
import type { TimedWord } from "../voice/voiceover.js";
import { getEdlDuration, getSegmentStarts, type Edl } from "./edl.js";
import type { FootageFilm } from "./film.js";

/**
 * The HyperFrames composition of a footage film (the same 0.8.85 contract as `composeFilm`): one `<video>` clip per
 * EDL segment over the normalized clip with its media start, the transitions (`fade` cross-fades from the segment
 * before, `zoom` punches in on alternate jump cuts, `whoosh` plays the whoosh sound), a slow zoom on b-roll, the
 * word-by-word captions, the end card over the cut's last frame, the cut speech track and the ducked music.
 */

const COMPOSITION_ID = "film";
/** A cross-fade's length; the outgoing segment plays on under the incoming one for this long. */
export const FADE_SECONDS = 0.35;
/** The punch-in of a `zoom` cut. */
const ZOOM_SCALE = 1.12;
/** How far a b-roll segment zooms over its length. */
const KEN_BURNS_SCALE = 1.08;
/** The end card's length after the cut. */
export const END_CARD_SECONDS = 3;

export interface FootageComposeAssets {
  /** The normalized clips by id. */
  clips: Record<string, string>;
  /** The cut speech track (as long as the cut). */
  speech: string;
  /** The ducked music track, or null for none. */
  music: string | null;
  /** The cut's last frame, under the end card. */
  lastFrame: string;
  logo: string | null;
  sfx: Partial<Record<SfxEvent, string>>;
}

export interface FootageComposeInput {
  film: FootageFilm;
  edl: Edl;
  /** The film's words in film time (`remapWords`), for the captions. */
  words: TimedWord[];
  frame: { width: number; height: number };
  caption: CaptionLayout;
  /** The end card's headline size. */
  headlineSize: number;
  colors: BrandColors;
  fonts: { heading: ComposeFont | null; body: ComposeFont | null };
  assets: FootageComposeAssets;
  brandName: string;
  locale: string;
}

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/** The film's length: the cut plus the end card. */
export function getFootageFilmSeconds(film: Pick<FootageFilm, "endCard">, edl: Edl): number {
  return r3(getEdlDuration(edl) + (film.endCard === null ? 0 : END_CARD_SECONDS));
}

/** The picture scale each segment starts at: `zoom` cuts alternate between punched in and back out. */
export function getSegmentScales(edl: Edl): number[] {
  const scales: number[] = [];
  edl.segments.forEach((segment, index) => {
    const previous = scales[index - 1] ?? 1;
    scales.push(segment.transition === "zoom" && index > 0 ? (previous === 1 ? ZOOM_SCALE : 1) : 1);
  });
  return scales;
}

export function composeFootage(input: FootageComposeInput): string {
  const { film, edl, words, frame, colors: c, fonts, assets, caption: captionBox } = input;
  const starts = getSegmentStarts(edl);
  const cutEnd = getEdlDuration(edl);
  const end = getFootageFilmSeconds(film, edl);
  const scales = getSegmentScales(edl);

  const segments = edl.segments.map((segment, index) => {
    const src = assets.clips[segment.clip];
    if (src === undefined) throw new Error(`The EDL names clip "${segment.clip}", which the film has no file for.`);
    const next = edl.segments[index + 1];
    const tail = next?.transition === "fade" ? FADE_SECONDS : 0;
    const start = starts[index] as number;
    const duration = r3(segment.end - segment.start + tail);
    const scale = scales[index] as number;
    const style = scale === 1 ? "" : ` style="transform:scale(${scale})"`;
    return `<video id="seg${index}" class="clip shot" src="${escapeHtml(src)}" data-start="${start}" data-media-start="${segment.start}" data-duration="${duration}"${style} muted playsinline></video>`;
  });

  const tweens: string[] = [];
  edl.segments.forEach((segment, index) => {
    const start = starts[index] as number;
    if (segment.transition === "fade" && index > 0) {
      tweens.push(`tl.fromTo("#seg${index}", { opacity: 0 }, { opacity: 1, duration: ${FADE_SECONDS}, ease: "none", immediateRender: false }, ${start});`);
    }
    if (segment.motion === "kenburns") {
      const from = scales[index] as number;
      tweens.push(
        `tl.fromTo("#seg${index}", { scale: ${from} }, { scale: ${r3(from * KEN_BURNS_SCALE)}, duration: ${r3(segment.end - segment.start)}, ease: "none", immediateRender: false }, ${start});`,
      );
    }
  });

  // --- Captions ---
  const caption = input.film.captions ? captionChunks(words) : [];
  const captionHtml = caption
    .map((chunk, i) => {
      const next = caption[i + 1];
      const start = r3(chunk.start - 0.05);
      const stop = Math.min(chunk.end + 0.35, next === undefined ? cutEnd : next.start - 0.06);
      const spans = chunk.words.map((w, j) => `<span id="cw${i}_${j}">${escapeHtml(w.text)}</span>`).join(" ");
      return `<div id="cap${i}" class="clip caption" data-start="${start}" data-duration="${r3(Math.max(0.1, stop - start))}"><p class="pill">${spans}</p></div>`;
    })
    .join("\n  ");

  // --- Sound ---
  const sfx: { src: string; t: number; volume: number; dur: number }[] = [];
  const play = (event: SfxEvent, t: number, volume: number, dur: number) => {
    const src = assets.sfx[event];
    if (src !== undefined) sfx.push({ src, t: r3(Math.max(0, t)), volume, dur });
  };
  edl.segments.forEach((segment, index) => {
    if (segment.transition === "whoosh" && index > 0) play("whoosh", (starts[index] as number) - 0.1, 0.45, 0.57);
  });
  if (film.endCard !== null) {
    play("whoosh", cutEnd, 0.3, 0.57);
    play("pop", r3(cutEnd + 0.9), 0.35, 0.72);
  }
  const audio = [
    `<audio id="speech" src="${escapeHtml(assets.speech)}" data-start="0" data-duration="${cutEnd}" data-volume="1"></audio>`,
    ...(assets.music === null ? [] : [`<audio id="music" src="${escapeHtml(assets.music)}" data-start="0" data-duration="${end}" data-volume="1"></audio>`]),
    ...sfx.map((s, i) => `<audio id="sfx${i}" src="${escapeHtml(s.src)}" data-start="${s.t}" data-duration="${s.dur}" data-volume="${s.volume}"></audio>`),
  ].join("\n  ");

  const tail = r3(end - cutEnd);
  const endCard = film.endCard;
  const endCardHtml =
    endCard === null
      ? ""
      : `<img id="last" class="clip shot" src="${escapeHtml(assets.lastFrame)}" data-start="${cutEnd}" data-duration="${tail}" />
  <div class="shade" id="shade"></div>
  <div class="endcard">
    <div class="brand" id="ec-brand">${assets.logo === null ? "" : `<img class="logo" src="${escapeHtml(assets.logo)}" alt="" />`}<span>${escapeHtml(input.brandName)}</span></div>
    <p class="headline" id="ec-headline">${escapeHtml(endCard.headline)}</p>
    <p class="url" id="ec-url">${escapeHtml(endCard.url)}</p>
    ${endCard.note.length > 0 ? `<p class="note" id="ec-note">${escapeHtml(endCard.note)}</p>` : ""}
  </div>`;
  const endCardTweens =
    endCard === null
      ? []
      : [
          `tl.fromTo("#shade", { opacity: 0 }, { opacity: 0.82, duration: 0.45, ease: "power2.out" }, ${cutEnd});`,
          `tl.fromTo("#ec-brand", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${r3(cutEnd + 0.3)});`,
          `tl.fromTo("#ec-headline", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, ${r3(cutEnd + 0.45)});`,
          `tl.fromTo("#ec-url", { y: 30, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "power3.out" }, ${r3(cutEnd + 0.9)});`,
          ...(endCard.note.length > 0 ? [`tl.fromTo("#ec-note", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, ${r3(cutEnd + 1.3)});`] : []),
        ];

  const bodyFont = fontStack(fonts.body, "sans-serif");
  const headingFont = fonts.heading === null ? bodyFont : fontStack(fonts.heading, "sans-serif");
  const faces = [...fontFaces(fonts.body), ...fontFaces(fonts.heading)];

  return `<!doctype html>
<html lang="${escapeHtml(input.locale)}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${frame.width}, height=${frame.height}" />
<title>${escapeHtml(film.title)}</title>
<script src="assets/gsap.min.js"></script>
<style>
${faces.join("\n")}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${frame.width}px;height:${frame.height}px;overflow:hidden;background:#000}
#root{position:relative;width:${frame.width}px;height:${frame.height}px;overflow:hidden;background:#000;font-family:${bodyFont};color:${c.foreground}}
.shot{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform-origin:50% 42%}
.shade{position:absolute;inset:0;background:${c.background};opacity:0}
.caption{position:absolute;left:${captionBox.left}px;right:${captionBox.right}px;top:${captionBox.top}px;display:flex;justify-content:center}
.pill{font-weight:650;font-size:${captionBox.fontSize}px;line-height:1.18;letter-spacing:-.01em;text-align:center;padding:16px 28px;border-radius:22px;background:${c.captionBackground};box-shadow:0 14px 44px rgba(0,0,0,.5);color:${c.captionText}}
.pill span{display:inline-block}
.endcard{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 80px;text-align:center}
.brand{display:flex;justify-content:center;align-items:center;gap:18px;font-family:${headingFont};font-size:46px}
.logo{height:60px;width:auto}
.headline{font-family:${headingFont};font-weight:500;font-size:${input.headlineSize}px;letter-spacing:-.025em;line-height:1.02;margin-top:44px}
.url{display:inline-block;margin-top:40px;padding:20px 38px;border-radius:999px;font-size:44px;font-weight:600;color:${c.onCta};background:${c.cta}}
.note{margin-top:26px;font-size:30px;color:${c.muted}}
</style>
</head>
<body>
<div id="root" data-composition-id="${COMPOSITION_ID}" data-start="0" data-duration="${end}" data-width="${frame.width}" data-height="${frame.height}">
  ${segments.join("\n  ")}
  ${endCardHtml}
  ${captionHtml}
  ${audio}
</div>
<script>
const tl = gsap.timeline({ paused: true });
${tweens.join("\n")}
const captions = ${JSON.stringify(caption.map((chunk) => chunk.words.map((w) => w.start)))};
captions.forEach((words, i) => {
  tl.fromTo("#cap" + i + " .pill", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.16, ease: "power3.out" }, Math.max(0, words[0] - 0.05));
  words.forEach((t, j) => tl.fromTo("#cw" + i + "_" + j, { color: "${c.captionText}" }, { color: "${c.captionHighlight}", duration: 0.06, immediateRender: false }, t).to("#cw" + i + "_" + j, { color: "${c.captionText}", duration: 0.2 }, t + 0.32));
});
${endCardTweens.join("\n")}
tl.set({}, {}, ${end});
window.__timelines = window.__timelines || {};
window.__timelines["${COMPOSITION_ID}"] = tl;
</script>
</body>
</html>
`;
}
