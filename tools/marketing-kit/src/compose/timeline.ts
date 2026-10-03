import type { TimedWord } from "../voice/voiceover.js";

/**
 * Frame and time geometry: pure functions the composition is built from.
 *
 * The 9:16 frame is 1080×1920 (the same for Reels, TikTok and Facebook Reels). The phone's screen is
 * 640 px wide in the frame whatever the recorded device, so every rectangle from the page is
 * multiplied by `screenScale` (640 / the device's CSS width).
 */

/** Render formats; the layout below is the 9:16 one (other formats are roadmap item MK-6). */
export const VIDEO_FORMATS = ["9:16"] as const;

export type VideoFormat = (typeof VIDEO_FORMATS)[number];

export interface Viewport {
  width: number;
  height: number;
}

export interface Geometry {
  frame: { width: number; height: number };
  /** The recorded device's CSS viewport. */
  viewport: Viewport;
  /** Where the phone's screen sits in the frame. */
  screen: { left: number; top: number; width: number };
  screenScale: number;
  /** The screen's height in the frame, rounded to px for CSS. */
  screenHeight: number;
  /** The point of the frame where the camera puts the centre of the watched element. */
  cameraTarget: { x: number; y: number };
}

const FRAME_9_16 = { width: 1080, height: 1920 } as const;
const SCREEN_9_16 = { left: 220, top: 214, width: 640 } as const;
const CAMERA_TARGET_9_16 = { x: 540, y: 900 } as const;

/** Whether a device's screen fits the 9:16 frame below the screen's top edge. */
export function fitsFrame(viewport: Viewport): boolean {
  return SCREEN_9_16.top + (viewport.height * SCREEN_9_16.width) / viewport.width <= FRAME_9_16.height;
}

/** The 9:16 layout for a recorded device. */
export function getGeometry(viewport: Viewport): Geometry {
  const screenScale = SCREEN_9_16.width / viewport.width;
  return {
    frame: { ...FRAME_9_16 },
    viewport: { ...viewport },
    screen: { ...SCREEN_9_16 },
    screenScale,
    screenHeight: Math.round(viewport.height * screenScale),
    cameraTarget: { ...CAMERA_TARGET_9_16 },
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
export function cameraPose(geometry: Geometry, rect: Rect, scale: number, target: { x: number; y: number } = geometry.cameraTarget): CameraPose {
  const { screen, screenScale } = geometry;
  const centerX = screen.left + screenScale * (rect.x + rect.w / 2);
  const centerY = screen.top + screenScale * (rect.y + rect.h / 2);
  return { scale, x: round(target.x - scale * centerX), y: round(target.y - scale * centerY) };
}

/** The whole phone screen in the frame, centred on the screen's centre. */
export function widePose(geometry: Geometry, scale = 1): CameraPose {
  const { viewport, screen, screenScale, frame } = geometry;
  return cameraPose(geometry, { x: 0, y: 0, w: viewport.width, h: viewport.height }, scale, {
    x: frame.width / 2,
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
