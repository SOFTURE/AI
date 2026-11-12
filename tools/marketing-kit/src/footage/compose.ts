import type { BrandColors } from "../config/colors.js";
import type { SfxEvent } from "../config/schema.js";
import type { ComposeFont } from "../compose/compose.js";
import { assertLocalReferences, escapeHtml, fontFaces, fontStack } from "../compose/html.js";
import { CAPTION_LINE_HEIGHT, getCaptionPillCss, getCaptionPositionCss, type CaptionLayout } from "../compose/timeline.js";
import type { TimedWord } from "../voice/voiceover.js";
import { CAPTION_HIGHLIGHT_BOX_PADDING_EM, CAPTION_HIGHLIGHT_BOX_RADIUS, CAPTION_HIGHLIGHT_SECONDS, CAPTION_UNDERLINE_EM, getCaptionEntranceTween, getCaptionHighlight } from "./caption-highlight.js";
import { CAPTION_SAFE_ZONES, getCaptionChunkLayouts, getCaptionSpans, getFootageCaptionChunks, isSameCaptionPlace, type CaptionSpan } from "./captions.js";
import { getCameraGsapEase, getCameraMoveSeconds, getCameraOrigin, isCameraMoving, toTransformOrigin } from "./camera.js";
import { getEdlDuration, getSegmentStarts, type Edl, type EdlSegment } from "./edl.js";
import {
  CAPTION_MIN_FONT_SCALE,
  DEFAULT_EDIT,
  DEFAULT_END_CARD_SECONDS,
  DEFAULT_LOGO_END_CARD_FADE_SECONDS,
  getEndCardSeconds,
  getFootageEdit,
  type FootageEdit,
  type FootageFilm,
  type LogoFootageEndCard,
} from "./film.js";
import { FOOTAGE_FPS } from "./normalize.js";
import { getOverlayMarkup } from "./overlay-html.js";
import type { ResolvedOverlay } from "./overlays.js";
import { getCaptionCornerRadius, getCornerRadiusCss, getStyleBorderCss, getStylePadding, getStyleShadowCss, type BrandStyle } from "./brand-style.js";
import { CAPTION_PILL_PADDING } from "../compose/timeline.js";

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/**
 * The HyperFrames composition of a footage film (the same 0.8.85 contract as `composeFilm`): one `<video>` clip per
 * EDL segment over the normalized clip with its media start, the transitions (`fade` cross-fades from the segment
 * before over `fadeFrames`, `zoom` punches in by `zoomPercent` on alternate jump cuts, eased over `zoomEaseFrames`, `whoosh` plays the whoosh
 * sound), a slow zoom on `kenburns` segments, the captions (plain phrases, or the word-highlight pill), the end card
 * over the cut's last frame (the full card, or the short logo card; its whoosh only with `isEndCardWhoosh`), the cut
 * speech track and the ducked music.
 */

const COMPOSITION_ID = "film";
/** The default cross-fade's length (`DEFAULT_EDIT.fadeFrames` at 30 fps); the outgoing segment plays on under the incoming one for this long. */
export const FADE_SECONDS = r3(DEFAULT_EDIT.fadeFrames / FOOTAGE_FPS);
/** How far a segment marked `kenburns` zooms when the film's `kenBurnsPercent` is 0 (a hand edit asked for it). */
const HAND_KEN_BURNS_PERCENT = 4;
/** The full end card's length after the cut when it sets no `seconds` (`DEFAULT_END_CARD_SECONDS`). */
export const END_CARD_SECONDS = DEFAULT_END_CARD_SECONDS;
/** The logo card's line, in px. */
const LOGO_CARD_LINE_SIZE = 64;
/** The largest box the logo card's logo is drawn in, in px: an SVG fills it, a PNG is never drawn past its own pixels. */
const LOGO_CARD_MARK = { width: 720, height: 480 };

export interface FootageComposeAssets {
  /** The normalized clips by id (read when there is no `picture`). */
  clips: Record<string, string>;
  /**
   * The cut's picture in film time (`planFootagePicture`, cross-fades drawn in): the composition then plays it as one
   * `<video>` and zooms that one element, instead of one `<video>` per segment. One video keeps hyperframes' frame
   * extraction to one ffmpeg and its Chrome renderer lean (issue #1030). Absent: one `<video>` per segment.
   */
  picture?: string;
  /** The cut speech track (as long as the cut). */
  speech: string;
  /** The ducked music track, or null for none. */
  music: string | null;
  /** The cut's last frame, under the end card. */
  lastFrame: string;
  /** The end card's logo (the logo card's own, else the brand's), an SVG or a PNG; null for the brand name alone. */
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
  /** The heading font (titles, keywords, numbers), the body font (captions) and the interface font (labels, lists); null falls back to the body font. */
  fonts: { heading: ComposeFont | null; body: ComposeFont | null; interface?: ComposeFont | null };
  assets: FootageComposeAssets;
  brandName: string;
  locale: string;
  /** The EDL's overlays, resolved (`resolveEdlOverlays`); absent or empty: none, and the composition is as without them. */
  overlays?: ResolvedOverlay[];
  /** The brand's style (`FootageBrand.style`): the pill's and the cards' radius, padding, shadow and border; absent: as before. */
  style?: BrandStyle;
}

/** The film's length: the cut plus the end card (`getEndCardSeconds`). */
export function getFootageFilmSeconds(film: Pick<FootageFilm, "endCard">, edl: Edl): number {
  return r3(getEdlDuration(edl) + getEndCardSeconds(film.endCard));
}

/**
 * The picture scale each segment starts at: `zoom` cuts alternate between punched in (`zoomPercent`) and back out; a
 * segment with a `camera` starts at its camera's `from`.
 */
export function getSegmentScales(edl: Edl, zoomPercent = DEFAULT_EDIT.zoomPercent): number[] {
  const scales: number[] = [];
  edl.segments.forEach((segment, index) => {
    const previous = scales[index - 1] ?? 1;
    if (segment.camera !== undefined) scales.push(segment.camera.from);
    else scales.push(segment.transition === "zoom" && index > 0 ? (previous === 1 ? zoomPercent / 100 : 1) : 1);
  });
  return scales;
}

/** The frames a segment's cut cross-fades over: its own `fadeFrames` or the film's on a `fade` after the first segment, else 0. */
export function getSegmentFadeFrames(edl: Pick<Edl, "segments">, index: number, edit: Pick<FootageEdit, "fadeFrames">): number {
  const segment: EdlSegment | undefined = edl.segments[index];
  if (segment === undefined || index === 0 || segment.transition !== "fade") return 0;
  return segment.fadeFrames ?? edit.fadeFrames;
}

/**
 * The frames each segment's zoom eases over (`zoomEaseFrames`, at most the segment's own frames): a `zoom` cut after
 * the first segment that changes the scale and is not `kenburns` (its slow zoom owns the scale); 0 for every other.
 */
export function getSegmentZoomEases(edl: Edl, edit: Pick<FootageEdit, "zoomPercent" | "zoomEaseFrames">): number[] {
  const scales = getSegmentScales(edl, edit.zoomPercent);
  return edl.segments.map((segment, index) => {
    const isEased = edit.zoomEaseFrames > 0 && index > 0 && segment.transition === "zoom" && segment.motion !== "kenburns" && segment.camera === undefined && scales[index - 1] !== scales[index];
    return isEased ? Math.max(1, Math.min(edit.zoomEaseFrames, Math.floor((segment.end - segment.start) * FOOTAGE_FPS))) : 0;
  });
}

/** One sound effect the film plays: its file, when it starts, its linear volume and how long it plays, in seconds. */
export interface FootageSfxCue {
  src: string;
  t: number;
  volume: number;
  dur: number;
}

/**
 * The film's sound effects in film time: a whoosh before every `whoosh` cut, and the end card's whoosh and pop with
 * `isEndCardWhoosh` (the pop only when it starts before the film's end); an event without a file in `sfx` plays nothing. The composition and the film's mix
 * (`buildFilmMixArgs`) both play these.
 */
export function getFootageSfxCues(film: FootageFilm, edl: Edl, sfx: Partial<Record<SfxEvent, string>>): FootageSfxCue[] {
  const starts = getSegmentStarts(edl);
  const cutEnd = getEdlDuration(edl);
  const edit = getFootageEdit(film);
  const cues: FootageSfxCue[] = [];
  const play = (event: SfxEvent, t: number, volume: number, dur: number) => {
    const src = sfx[event];
    if (src !== undefined) cues.push({ src, t: r3(Math.max(0, t)), volume, dur });
  };
  edl.segments.forEach((segment, index) => {
    if (segment.transition === "whoosh" && index > 0) play("whoosh", (starts[index] as number) - 0.1, 0.45, 0.57);
  });
  if (film.endCard !== null && edit.isEndCardWhoosh) {
    play("whoosh", cutEnd, 0.3, 0.57);
    const pop = r3(cutEnd + 0.9);
    if (pop < getFootageFilmSeconds(film, edl)) play("pop", pop, 0.35, 0.72);
  }
  return cues;
}

export function composeFootage(input: FootageComposeInput): string {
  const { film, edl, words, frame, colors: c, fonts, assets, caption: captionBox } = input;
  const starts = getSegmentStarts(edl);
  const cutEnd = getEdlDuration(edl);
  const end = getFootageFilmSeconds(film, edl);
  const edit = getFootageEdit(film);
  const scales = getSegmentScales(edl, edit.zoomPercent);
  const eases = getSegmentZoomEases(edl, edit);
  const fadeSecondsAt = (index: number): number => r3(getSegmentFadeFrames(edl, index, edit) / FOOTAGE_FPS);
  // A film with a camera anchors its zooms per segment; one without keeps the stylesheet's origin (and its markup).
  const hasCamera = edl.segments.some((segment) => segment.camera !== undefined);
  const originOf = (segment: EdlSegment): string => toTransformOrigin(getCameraOrigin(segment.camera));
  const kenBurnsScale = 1 + (edit.kenBurnsPercent > 0 ? edit.kenBurnsPercent : HAND_KEN_BURNS_PERCENT) / 100;

  const picture = assets.picture;
  const segments =
    picture === undefined
      ? edl.segments.map((segment, index) => {
          const src = assets.clips[segment.clip];
          if (src === undefined) throw new Error(`The EDL names clip "${segment.clip}", which the film has no file for.`);
          const tail = fadeSecondsAt(index + 1);
          const start = starts[index] as number;
          const duration = r3(segment.end - segment.start + tail);
          const scale = scales[index] as number;
          const origin = segment.camera === undefined ? "" : `;transform-origin:${originOf(segment)}`;
          const style = scale === 1 && origin === "" ? "" : ` style="transform:scale(${scale})${origin}"`;
          return `<video id="seg${index}" class="clip shot" src="${escapeHtml(src)}" data-start="${start}" data-media-start="${segment.start}" data-duration="${duration}"${style} muted playsinline></video>`;
        })
      : [`<video id="picture" class="clip shot" src="${escapeHtml(picture)}" data-start="0" data-media-start="0" data-duration="${cutEnd}" muted playsinline></video>`];

  const tweens: string[] = [];
  edl.segments.forEach((segment, index) => {
    const start = starts[index] as number;
    const scale = scales[index] as number;
    const target = picture === undefined ? `#seg${index}` : "#picture";
    // One video carries every segment: each one sets the zoom it starts at (a fade is already in the picture).
    if (picture !== undefined) tweens.push(hasCamera ? `tl.set("#picture", { scale: ${scale}, transformOrigin: "${originOf(segment)}" }, ${start});` : `tl.set("#picture", { scale: ${scale} }, ${start});`);
    if (picture === undefined && segment.transition === "fade" && index > 0) {
      tweens.push(`tl.fromTo("${target}", { opacity: 0 }, { opacity: 1, duration: ${fadeSecondsAt(index)}, ease: "none", immediateRender: false }, ${start});`);
    }
    const { camera } = segment;
    if (camera !== undefined && isCameraMoving(camera)) {
      const seconds = getCameraMoveSeconds(camera, segment.end - segment.start);
      tweens.push(`tl.fromTo("${target}", { scale: ${camera.from} }, { scale: ${camera.to}, duration: ${seconds}, ease: "${getCameraGsapEase(camera.ease)}", immediateRender: false }, ${start});`);
    }
    const ease = eases[index] as number;
    if (ease > 0) {
      // Eases from the scale on screen before the cut, so the punch-in (or back out) reads as one move of the camera.
      tweens.push(
        `tl.fromTo("${target}", { scale: ${scales[index - 1] as number} }, { scale: ${scales[index] as number}, duration: ${r3(ease / FOOTAGE_FPS)}, ease: "power1.out", immediateRender: false }, ${start});`,
      );
    }
    if (segment.motion === "kenburns") {
      tweens.push(
        `tl.fromTo("${target}", { scale: ${scale} }, { scale: ${r3(scale * kenBurnsScale)}, duration: ${r3(segment.end - segment.start)}, ease: "none", immediateRender: false }, ${start});`,
      );
    }
  });

  // --- Overlays: the punch-in zooms the segment's picture (eased in, held, eased back), the others are clips of their own ---
  const overlays = input.overlays ?? [];
  for (const overlay of overlays) {
    if (overlay.kind !== "punch_in") continue;
    const target = picture === undefined ? `#seg${overlay.segment}` : "#picture";
    const base = scales[overlay.segment] as number;
    const peak = r3(base * overlay.scale);
    tweens.push(
      `tl.fromTo("${target}", { scale: ${base} }, { scale: ${peak}, duration: ${overlay.ease}, ease: "sine.inOut", immediateRender: false }, ${overlay.start});`,
      `tl.fromTo("${target}", { scale: ${peak} }, { scale: ${base}, duration: ${overlay.ease}, ease: "sine.inOut", immediateRender: false }, ${r3(overlay.end - overlay.ease)});`,
    );
  }

  // --- Captions: plain phrases, or the pill that lights each word ---
  const isHighlight = film.captionStyle === "highlight";
  const highlight = isHighlight ? getCaptionHighlight(film, c) : ({ ok: true, look: { style: "text", color: c.captionHighlight } } as const);
  // The pipeline refuses such a film before it composes; reaching here is a bug.
  if (!highlight.ok) throw new Error(`composeFootage: ${highlight.error}`);
  const look = highlight.look;
  const isBox = isHighlight && look.style === "box";
  const isUnderline = isHighlight && look.style === "underline";
  const entrance = getCaptionEntranceTween(film.captionEntrance);
  const caption = getFootageCaptionChunks(film, words);
  const spans = getCaptionSpans(caption, cutEnd);
  const boxes = getCaptionChunkLayouts(caption, edl, captionBox);
  const captionHtml = caption
    .map((chunk, i) => {
      const { start, end: stop } = spans[i] as CaptionSpan;
      const place = boxes[i] ?? captionBox;
      // A chunk in a segment's own box overrides the shared rule's anchor; one in the film's box is written as before.
      const style = isSameCaptionPlace(place, captionBox) ? "" : ` style="${place.bottom === undefined ? `bottom:auto;top:${place.top}px` : `top:auto;bottom:${place.bottom}px`}"`;
      const box = isHighlight
        ? `<p class="pill">${chunk.words.map((w, j) => `<span id="cw${i}_${j}">${isBox ? `<i class="hl" id="cb${i}_${j}"></i>` : ""}${isUnderline ? `<i class="ul" id="cu${i}_${j}"></i>` : ""}${escapeHtml(w.text)}</span>`).join(" ")}</p>`
        : `<p class="phrase">${escapeHtml(chunk.words.map((w) => w.text).join(" "))}</p>`;
      return `<div id="cap${i}" class="clip caption" data-start="${start}" data-duration="${r3(stop - start)}"${style}>${box}</div>`;
    })
    .join("\n  ");

  const captionFit = film.captions && film.captionMaxLines !== undefined ? getCaptionFitScript(film.captionMaxLines, Math.round(captionBox.fontSize * CAPTION_MIN_FONT_SCALE)) : "";

  // --- Sound ---
  const sfx = getFootageSfxCues(film, edl, assets.sfx);
  const audio = [
    `<audio id="speech" src="${escapeHtml(assets.speech)}" data-start="0" data-duration="${cutEnd}" data-volume="1"></audio>`,
    ...(assets.music === null ? [] : [`<audio id="music" src="${escapeHtml(assets.music)}" data-start="0" data-duration="${end}" data-volume="1"></audio>`]),
    ...sfx.map((s, i) => `<audio id="sfx${i}" src="${escapeHtml(s.src)}" data-start="${s.t}" data-duration="${s.dur}" data-volume="${s.volume}"></audio>`),
  ].join("\n  ");

  const tail = r3(end - cutEnd);
  const endCard = film.endCard;
  const lastFrameHtml = `<img id="last" class="clip shot" src="${escapeHtml(assets.lastFrame)}" data-start="${cutEnd}" data-duration="${tail}" />`;
  // The full card's entrances were timed for 3 s; a shorter card plays them faster, so the last one ends on screen.
  const pace = endCard === null ? 1 : Math.min(1, getEndCardSeconds(endCard) / DEFAULT_END_CARD_SECONDS);
  const paced = (seconds: number): number => r3(seconds * pace);
  const endCardHtml =
    endCard === null
      ? ""
      : endCard.layout === "logo"
        ? `${lastFrameHtml}
  ${getLogoCardHtml(endCard, assets.logo, input.brandName)}`
        : `${lastFrameHtml}
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
      : endCard.layout === "logo"
        ? [`tl.fromTo("#ec-logo-card", { opacity: 0 }, { opacity: 1, duration: ${r3(endCard.fadeSeconds ?? DEFAULT_LOGO_END_CARD_FADE_SECONDS)}, ease: "none" }, ${cutEnd});`]
        : [
            `tl.fromTo("#shade", { opacity: 0 }, { opacity: 0.82, duration: ${paced(0.45)}, ease: "power2.out" }, ${cutEnd});`,
            `tl.fromTo("#ec-brand", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: ${paced(0.5)}, ease: "power3.out" }, ${r3(cutEnd + paced(0.3))});`,
            `tl.fromTo("#ec-headline", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: ${paced(0.6)}, ease: "power3.out" }, ${r3(cutEnd + paced(0.45))});`,
            `tl.fromTo("#ec-url", { y: 30, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: ${paced(0.55)}, ease: "power3.out" }, ${r3(cutEnd + paced(0.9))});`,
            ...(endCard.note.length > 0 ? [`tl.fromTo("#ec-note", { opacity: 0 }, { opacity: 1, duration: ${paced(0.5)}, ease: "power2.out" }, ${r3(cutEnd + paced(1.3))});`] : []),
          ];
  const logoBox = getLogoCardBox(film, frame);

  const bodyFont = fontStack(fonts.body, "sans-serif");
  const headingFont = fonts.heading === null ? bodyFont : fontStack(fonts.heading, "sans-serif");
  const interfaceFont = fonts.interface == null ? bodyFont : fontStack(fonts.interface, "sans-serif");
  const faces = [...fontFaces(fonts.body), ...fontFaces(fonts.heading), ...fontFaces(fonts.interface ?? null)];
  const overlayMarkup = getOverlayMarkup(overlays, { colors: c, headingFont, interfaceFont, locale: input.locale, frame, ...(input.style === undefined ? {} : { style: input.style }) });

  return assertLocalReferences(`<!doctype html>
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
.caption{position:absolute;left:${captionBox.left}px;right:${captionBox.right}px;${getCaptionPositionCss(captionBox)};display:flex;justify-content:center}
.pill{${getCaptionPillCss(captionBox.fontSize)};border-radius:22px;background:${c.captionBackground};box-shadow:0 14px 44px rgba(0,0,0,.5);color:${c.captionText}}
${input.style === undefined ? "" : `${getStyledPillCss(input.style, look.style === "box" ? look.box : c.captionHighlight)}\n`}.pill span{display:inline-block}
${isBox ? `.pill{position:relative;z-index:0}
.pill span{position:relative}
.hl{position:absolute;top:0;bottom:0;left:-${CAPTION_HIGHLIGHT_BOX_PADDING_EM}em;right:-${CAPTION_HIGHLIGHT_BOX_PADDING_EM}em;z-index:-1;border-radius:${CAPTION_HIGHLIGHT_BOX_RADIUS}px;background:${look.box};opacity:0}
` : ""}${isUnderline ? `.pill span{position:relative}
.ul{position:absolute;left:0;right:0;top:${CAPTION_UNDERLINE_EM.top}em;height:${CAPTION_UNDERLINE_EM.thickness}em;border-radius:${CAPTION_UNDERLINE_EM.thickness / 2}em;background:${look.color};opacity:0}
` : ""}.phrase{font-weight:650;font-size:${captionBox.fontSize}px;line-height:${CAPTION_LINE_HEIGHT};letter-spacing:-.01em;text-align:center;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.55),0 0 18px rgba(0,0,0,.35)}
.endcard{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 80px;text-align:center}
.brand{display:flex;justify-content:center;align-items:center;gap:18px;font-family:${headingFont};font-size:46px}
.logo{height:60px;width:auto}
.headline{font-family:${headingFont};font-weight:500;font-size:${input.headlineSize}px;letter-spacing:-.025em;line-height:1.02;margin-top:44px}
.url{display:inline-block;margin-top:40px;padding:20px 38px;border-radius:${input.style === undefined ? "999px" : getCornerRadiusCss(input.style.cornerRadius)};font-size:44px;font-weight:600;color:${c.onCta};background:${c.cta}}
.note{margin-top:26px;font-size:30px;color:${c.muted}}
.logocard{position:absolute;inset:0;background:${c.background};opacity:0}
.logobox{position:absolute;top:${logoBox.top}px;bottom:${logoBox.bottom}px;left:${logoBox.left}px;right:${logoBox.right}px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:48px;text-align:center}
.mark{display:block;max-width:min(100%,${LOGO_CARD_MARK.width}px);max-height:${LOGO_CARD_MARK.height}px;width:auto;height:auto}
.mark.vector{width:min(100%,${LOGO_CARD_MARK.width}px);height:${LOGO_CARD_MARK.height}px;object-fit:contain}
.markname{font-family:${headingFont};font-weight:600;font-size:96px;letter-spacing:-.02em}
.logoline{font-family:${headingFont};font-weight:600;font-size:${LOGO_CARD_LINE_SIZE}px;line-height:1.15;letter-spacing:-.01em}
${overlayMarkup.css.map((rule) => `${rule}\n`).join("")}</style>
</head>
<body>
<div id="root" data-composition-id="${COMPOSITION_ID}" data-start="0" data-duration="${end}" data-width="${frame.width}" data-height="${frame.height}">
  ${segments.join("\n  ")}
  ${endCardHtml}
  ${overlayMarkup.html.map((element) => `${element}\n  `).join("")}${captionHtml}
  ${audio}
</div>
${captionFit}<script>
const tl = gsap.timeline({ paused: true });
${tweens.join("\n")}
const captions = ${JSON.stringify(isHighlight ? caption.map((chunk) => chunk.words.map((w) => w.start)) : [])};
captions.forEach((words, i) => {
${entrance === null ? "" : `  tl.fromTo("#cap" + i + " .pill", ${toTweenVars(entrance.from)}, ${toTweenVars(entrance.to)}, Math.max(0, words[0] - 0.05));\n`}${
  look.style === "underline"
    ? `  words.forEach((t, j) => tl.fromTo("#cu" + i + "_" + j, { opacity: 0 }, { opacity: 1, duration: 0.06, immediateRender: false }, t).to("#cu" + i + "_" + j, { opacity: 0, duration: 0.2 }, t + ${CAPTION_HIGHLIGHT_SECONDS}));`
    : look.style === "box"
    ? `  words.forEach((t, j) => {
    tl.fromTo("#cb" + i + "_" + j, { opacity: 0 }, { opacity: 1, duration: 0.06, immediateRender: false }, t).to("#cb" + i + "_" + j, { opacity: 0, duration: 0.2 }, t + ${CAPTION_HIGHLIGHT_SECONDS});
    tl.fromTo("#cw" + i + "_" + j, { color: "${c.captionText}" }, { color: "${look.text}", duration: 0.06, immediateRender: false }, t).to("#cw" + i + "_" + j, { color: "${c.captionText}", duration: 0.2 }, t + ${CAPTION_HIGHLIGHT_SECONDS});
  });`
    : `  words.forEach((t, j) => tl.fromTo("#cw" + i + "_" + j, { color: "${c.captionText}" }, { color: "${look.color}", duration: 0.06, immediateRender: false }, t).to("#cw" + i + "_" + j, { color: "${c.captionText}", duration: 0.2 }, t + 0.32));`
}
});
${overlayMarkup.tweens.map((tween) => `${tween}\n`).join("")}${endCardTweens.join("\n")}
tl.set({}, {}, ${end});
window.__timelines = window.__timelines || {};
window.__timelines["${COMPOSITION_ID}"] = tl;
</script>
</body>
</html>
`);
}

/** Tween vars as the page's script writes them: `{ y: 14, opacity: 0 }`, strings quoted. */
function toTweenVars(vars: Record<string, number | string>): string {
  return `{ ${Object.entries(vars).map(([key, value]) => `${key}: ${typeof value === "string" ? JSON.stringify(value) : String(value)}`).join(", ")} }`;
}

/** The caption pill's rule in the brand's style, after the pill's own: its radius, padding, shadow and border in `accent`. */
export function getStyledPillCss(style: BrandStyle, accent: string): string {
  const pad = getStylePadding(CAPTION_PILL_PADDING, style.padding);
  return `.pill{border-radius:${getCornerRadiusCss(getCaptionCornerRadius(style))};padding:${String(pad.y)}px ${String(pad.x)}px;box-shadow:${getStyleShadowCss(style)};border:${getStyleBorderCss(style, accent)}}`;
}

/**
 * The logo card (`layout: "logo"`): the brand's background over the whole frame, the logo (an SVG drawn as a vector to
 * fill its box, a PNG at most at its own size, so neither is drawn soft) or the brand name, and the optional line.
 */
function getLogoCardHtml(card: LogoFootageEndCard, logo: string | null, brandName: string): string {
  const isVector = logo !== null && /\.svg$/i.test(logo);
  const mark = logo === null ? `<span class="markname">${escapeHtml(brandName)}</span>` : `<img class="mark${isVector ? " vector" : ""}" src="${escapeHtml(logo)}" alt="" />`;
  const line = card.line.trim().length > 0 ? `<p class="logoline">${escapeHtml(card.line)}</p>` : "";
  return `<div class="logocard" id="ec-logo-card"><div class="logobox">${mark}${line}</div></div>`;
}

/**
 * Where the logo card's content sits, in px from the frame's edges: a 9:16 film keeps it inside its caption preset's
 * safe zone (`CAPTION_SAFE_ZONES`, `all` without a preset), centred between equal sides; other frames keep 80 px.
 */
export function getLogoCardBox(film: Pick<FootageFilm, "format" | "captionPreset">, frame: { width: number; height: number }): { top: number; bottom: number; left: number; right: number } {
  if (film.format !== "9:16" || frame.height !== 1920) return { top: 80, bottom: 80, left: 80, right: 80 };
  const zone = CAPTION_SAFE_ZONES[film.captionPreset ?? "all"];
  const side = Math.max(zone.left, zone.right);
  return { top: zone.top, bottom: zone.bottom, left: side, right: side };
}

/**
 * A page script that shrinks each caption's font in 1 px steps until its text takes at most `maxLines` lines, or the
 * font reaches `minFontSize`. Only the browser knows how the font wraps, so it measures there: once at load and again
 * when the fonts are ready (hyperframes waits for them before the first frame). Hidden clips keep their layout.
 */
function getCaptionFitScript(maxLines: number, minFontSize: number): string {
  return `<script>
(() => {
  const captionMaxLines = ${maxLines}, captionMinFontSize = ${minFontSize};
  const countLines = (el) => {
    const style = getComputedStyle(el);
    return Math.round((el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)) / parseFloat(style.lineHeight));
  };
  const fit = () => document.querySelectorAll(".caption > p").forEach((el) => {
    el.style.fontSize = "";
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (countLines(el) > captionMaxLines && size > captionMinFontSize) {
      size -= 1;
      el.style.fontSize = size + "px";
    }
  });
  fit();
  if (document.fonts) document.fonts.ready.then(fit);
})();
</script>
`;
}
