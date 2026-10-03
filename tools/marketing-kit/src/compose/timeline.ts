import type { TimedWord } from "../voice/voiceover.js";

/**
 * Frame and time geometry: pure functions the composition is built from.
 *
 * Each format has a layout (`LAYOUTS`): the frame, the box the phone's screen fits in, the camera
 * target, the caption box, the persona card and the end card. The screen takes the box's full width
 * unless the device is too tall for its height, so every rectangle from the page is multiplied by
 * `screenScale` (screen width / the device's CSS width).
 *
 * Camera scales are relative to the phone, not to the frame, so one recording renders in every format.
 */

export const VIDEO_FORMATS = ["9:16", "1:1", "16:9"] as const;

export type VideoFormat = (typeof VIDEO_FORMATS)[number];

export interface Viewport {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** A block of copy laid across the frame: `left` and `right` are its margins from the frame's edges. */
export interface TextBox {
  top: number;
  left: number;
  right: number;
}

export interface CaptionLayout extends TextBox {
  fontSize: number;
}

export interface EndCardLayout extends TextBox {
  headlineSize: number;
  /** The phone while the end card shows: its scale and where the screen's centre goes. */
  phone: { scale: number; center: Point };
}

export interface Layout {
  frame: { width: number; height: number };
  /** The screen is centred on `centerX`, starts at `top`, and is at most `maxWidth` × `maxHeight`. */
  phoneBox: { centerX: number; top: number; maxWidth: number; maxHeight: number };
  /** The point of the frame where the camera puts the centre of the watched element. */
  cameraTarget: Point;
  caption: CaptionLayout;
  persona: TextBox;
  endCard: EndCardLayout;
}

/**
 * 9:16 (Reels, TikTok): the phone fills the width, captions over its foot, the end card below a small phone.
 * 1:1 (feed): a shorter phone, the same column. 16:9 (YouTube, LinkedIn): the phone on the left, copy on the right.
 */
export const LAYOUTS: Record<VideoFormat, Layout> = {
  "9:16": {
    frame: { width: 1080, height: 1920 },
    phoneBox: { centerX: 540, top: 214, maxWidth: 640, maxHeight: 1706 },
    cameraTarget: { x: 540, y: 900 },
    caption: { top: 1470, left: 60, right: 60, fontSize: 50 },
    persona: { top: 78, left: 0, right: 0 },
    endCard: { top: 1180, left: 0, right: 0, headlineSize: 96, phone: { scale: 0.58, center: { x: 540, y: 640 } } },
  },
  "1:1": {
    frame: { width: 1080, height: 1080 },
    phoneBox: { centerX: 540, top: 150, maxWidth: 640, maxHeight: 900 },
    cameraTarget: { x: 540, y: 480 },
    caption: { top: 830, left: 60, right: 60, fontSize: 44 },
    persona: { top: 30, left: 0, right: 0 },
    endCard: { top: 470, left: 0, right: 0, headlineSize: 72, phone: { scale: 0.42, center: { x: 540, y: 250 } } },
  },
  "16:9": {
    frame: { width: 1920, height: 1080 },
    phoneBox: { centerX: 600, top: 90, maxWidth: 640, maxHeight: 900 },
    cameraTarget: { x: 600, y: 500 },
    caption: { top: 700, left: 1100, right: 120, fontSize: 50 },
    persona: { top: 150, left: 1100, right: 120 },
    endCard: { top: 330, left: 1100, right: 120, headlineSize: 80, phone: { scale: 0.85, center: { x: 600, y: 540 } } },
  },
};

export interface Geometry {
  format: VideoFormat;
  frame: { width: number; height: number };
  /** The recorded device's CSS viewport. */
  viewport: Viewport;
  /** Where the phone's screen sits in the frame. */
  screen: { left: number; top: number; width: number };
  screenScale: number;
  /** The screen's height in the frame, rounded to px for CSS. */
  screenHeight: number;
  cameraTarget: Point;
  caption: CaptionLayout;
  persona: TextBox;
  endCard: EndCardLayout;
}

/**
 * Whether a device's screen fits the 9:16 frame below the screen's top edge at full width. In the
 * other formats the screen narrows to fit, so any device that passes here fits them too.
 */
export function fitsFrame(viewport: Viewport): boolean {
  const { phoneBox } = LAYOUTS["9:16"];
  return (viewport.height * phoneBox.maxWidth) / viewport.width <= phoneBox.maxHeight;
}

/**
 * The layout of a format for a recorded device. The recorder uses the 9:16 default: its camera
 * scales are relative to the phone and serve every format.
 */
export function getGeometry(viewport: Viewport, format: VideoFormat = "9:16"): Geometry {
  const layout = LAYOUTS[format];
  const { phoneBox } = layout;
  const width = Math.min(phoneBox.maxWidth, Math.floor((phoneBox.maxHeight * viewport.width) / viewport.height));
  const screenScale = width / viewport.width;
  return {
    format,
    frame: { ...layout.frame },
    viewport: { ...viewport },
    screen: { left: Math.round(phoneBox.centerX - width / 2), top: phoneBox.top, width },
    screenScale,
    screenHeight: Math.round(viewport.height * screenScale),
    cameraTarget: { ...layout.cameraTarget },
    caption: { ...layout.caption },
    persona: { ...layout.persona },
    endCard: { ...layout.endCard, phone: { scale: layout.endCard.phone.scale, center: { ...layout.endCard.phone.center } } },
  };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CameraPose {
  scale: number;
  x: number;
  y: number;
}

// `|| 0` turns -0 (e.g. 1.65 / 1.1 - 1.5) into 0; otherwise toEqual sees a difference.
const round = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/**
 * Camera pose (scale + offset of the layer holding the phone, origin in the top left corner) that
 * puts the centre of a page rectangle on `target`.
 */
export function cameraPose(geometry: Geometry, rect: Rect, scale: number, target: Point = geometry.cameraTarget): CameraPose {
  const { screen, screenScale } = geometry;
  const centerX = screen.left + screenScale * (rect.x + rect.w / 2);
  const centerY = screen.top + screenScale * (rect.y + rect.h / 2);
  return { scale, x: round(target.x - scale * centerX), y: round(target.y - scale * centerY) };
}

/** The whole phone screen in the frame, kept where the layout puts it (its centre stays in place). */
export function widePose(geometry: Geometry, scale = 1): CameraPose {
  const { viewport, screen, screenScale } = geometry;
  return cameraPose(geometry, { x: 0, y: 0, w: viewport.width, h: viewport.height }, scale, {
    x: screen.left + screen.width / 2,
    // The exact height, not `screenHeight` (rounded to px for CSS); otherwise "the whole screen"
    // moves by a fraction of a pixel.
    y: screen.top + (viewport.height * screenScale) / 2,
  });
}

/**
 * Scale at which the element fills ~80% of the frame width, capped because the recording has
 * (device scale × CSS width) px for the screen's width: above 1.8× the picture stops being sharp.
 */
export function fitScale(geometry: Geometry, rect: Rect, max = 1.7): number {
  const fill = (geometry.frame.width * 0.8) / (geometry.screenScale * rect.w);
  return round(Math.min(max, Math.max(1, fill)));
}

/** The smallest rectangle that encloses all of them. */
export function unionRect(rects: Rect[]): Rect {
  if (rects.length === 0) throw new Error("unionRect: empty list of rectangles.");
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export interface CaptionChunk {
  words: TimedWord[];
  start: number;
  end: number;
}

/**
 * Words → caption chunks: at most `maxWords` words, broken after the end of a sentence and after a
 * comma, so a caption does not glue two thoughts together.
 */
export function captionChunks(words: TimedWord[], maxWords = 4): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  let current: TimedWord[] = [];
  const flush = () => {
    const first = current[0];
    const last = current[current.length - 1];
    if (first === undefined || last === undefined) return;
    chunks.push({ words: current, start: first.start, end: last.end });
    current = [];
  };
  for (const word of words) {
    current.push(word);
    if (/[.,?!:;]$/.test(word.text) || current.length === maxWords) flush();
  }
  flush();
  return chunks;
}

/**
 * Rewind frames: `count` frames from the opening frame (`still`) back to the start of the scene
 * (`first`), evenly spread, both ends included. On a short span frames repeat; the clip always has
 * `count` frames.
 *
 * Replaces ffmpeg's `select` filter, which with `-frames:v` as an output option took the whole
 * recording from `first` to the end (45 frames instead of 24, measured in FIRE).
 */
export function rewindFrames(first: number, still: number, count = 24): number[] {
  if (still < first) throw new Error(`The opening frame (${still}) is before the start of the scene (${first}).`);
  if (count < 2) throw new Error("A rewind needs at least two frames.");
  return Array.from({ length: count }, (_, k) => Math.round(still - ((still - first) * k) / (count - 1)));
}
