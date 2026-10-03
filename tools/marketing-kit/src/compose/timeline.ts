import type { TimedWord } from "../voice/voiceover.js";

/**
 * Frame and time geometry: pure functions the composition is built from.
 *
 * Frame 1080×1920 (9:16, the same for Reels, TikTok and Facebook Reels). The phone is recorded at
 * 390×844 CSS px (@3×) and its screen is 640 px wide in the frame, so every rectangle from the page
 * is multiplied by `SCREEN_SCALE`.
 */

export const FRAME = { width: 1080, height: 1920 } as const;
export const VIEWPORT = { width: 390, height: 844 } as const;
export const SCREEN = { left: 220, top: 214, width: 640 } as const;
export const SCREEN_SCALE = SCREEN.width / VIEWPORT.width;
export const SCREEN_HEIGHT = Math.round(VIEWPORT.height * SCREEN_SCALE);
/** The point of the frame where the camera puts the centre of the watched element. */
export const CAMERA_TARGET = { x: 540, y: 900 } as const;

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
export function cameraPose(rect: Rect, scale: number, target: { x: number; y: number } = CAMERA_TARGET): CameraPose {
  const centerX = SCREEN.left + SCREEN_SCALE * (rect.x + rect.w / 2);
  const centerY = SCREEN.top + SCREEN_SCALE * (rect.y + rect.h / 2);
  return { scale, x: round(target.x - scale * centerX), y: round(target.y - scale * centerY) };
}

/** The whole phone screen in the frame, centred on the screen's centre. */
export function widePose(scale = 1): CameraPose {
  return cameraPose({ x: 0, y: 0, w: VIEWPORT.width, h: VIEWPORT.height }, scale, {
    x: FRAME.width / 2,
    // The exact height, not `SCREEN_HEIGHT` (rounded to px for CSS); otherwise "the whole screen"
    // moves by a fraction of a pixel.
    y: SCREEN.top + (VIEWPORT.height * SCREEN_SCALE) / 2,
  });
}

/**
 * Scale at which the element fills ~80% of the frame width, capped because the recording has
 * 1170 px for 640 px of screen: above 1.8× the picture stops being sharp.
 */
export function fitScale(rect: Rect, max = 1.7): number {
  const fill = (FRAME.width * 0.8) / (SCREEN_SCALE * rect.w);
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
