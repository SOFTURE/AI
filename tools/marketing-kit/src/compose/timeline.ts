import type { TimedWord } from "../voice/voiceover.js";

/**
 * Frame and time geometry: pure functions the composition is built from.
 *
 * Each layout (`LAYOUTS`) is one format with one window around the recorded screen: a phone in every format, or a
 * browser window in 16:9 for a desktop recording (`desktop`). It holds the frame, the box the screen fits in, the
 * camera target, the caption box, the persona card and the end card. The screen takes the box's full width unless the
 * device is too tall for its height, so every rectangle from the page is multiplied by `screenScale` (screen width /
 * the device's CSS width).
 *
 * Camera scales are relative to the screen, not to the frame, so one phone recording renders in every format. A
 * desktop recording renders in the desktop layout only.
 *
 * A project can override the copy and the end card of a layout (`marketing.json` `layout`, see `LayoutOverride`),
 * never the frame, the screen box or the camera target: the recorder sizes its camera moves from those.
 */

export const VIDEO_FORMATS = ["9:16", "1:1", "16:9"] as const;

export type VideoFormat = (typeof VIDEO_FORMATS)[number];

/** What records the film: a phone (every format) or a desktop browser (16:9 only). */
export const DEVICE_KINDS = ["phone", "desktop"] as const;

export type DeviceKind = (typeof DEVICE_KINDS)[number];

/** A layout per format for phone films, and `desktop` for 16:9 desktop films. */
export const LAYOUT_NAMES = [...VIDEO_FORMATS, "desktop"] as const;

export type LayoutName = (typeof LAYOUT_NAMES)[number];

/** What the composition draws around the screen. */
export type WindowKind = "phone" | "browser";

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
  /** The phone (or browser window) while the end card shows: its scale and where the screen's centre goes. */
  phone: { scale: number; center: Point };
}

export interface Layout {
  format: VideoFormat;
  window: WindowKind;
  frame: { width: number; height: number };
  /** The screen is centred on `centerX`, starts at `top`, and is at most `maxWidth` × `maxHeight`. */
  screenBox: { centerX: number; top: number; maxWidth: number; maxHeight: number };
  /** The point of the frame where the camera puts the centre of the watched element. */
  cameraTarget: Point;
  caption: CaptionLayout;
  persona: TextBox;
  endCard: EndCardLayout;
}

/**
 * 9:16 (Reels, TikTok): the phone fills the width, captions over its foot, the end card below a small phone.
 * 1:1 (feed): a shorter phone, the same column. 16:9 (YouTube, LinkedIn): the phone on the left, copy on the right.
 * Desktop (16:9): a browser window across the frame (its bar stands above the screen box), captions over its foot,
 * the persona card above it; at the end card the window shrinks to the left and the copy stands on the right.
 */
export const LAYOUTS: Record<LayoutName, Layout> = {
  "9:16": {
    format: "9:16",
    window: "phone",
    frame: { width: 1080, height: 1920 },
    screenBox: { centerX: 540, top: 214, maxWidth: 640, maxHeight: 1706 },
    cameraTarget: { x: 540, y: 900 },
    caption: { top: 1470, left: 60, right: 60, fontSize: 50 },
    persona: { top: 78, left: 0, right: 0 },
    endCard: { top: 1180, left: 0, right: 0, headlineSize: 96, phone: { scale: 0.58, center: { x: 540, y: 640 } } },
  },
  "1:1": {
    format: "1:1",
    window: "phone",
    frame: { width: 1080, height: 1080 },
    screenBox: { centerX: 540, top: 150, maxWidth: 640, maxHeight: 900 },
    cameraTarget: { x: 540, y: 480 },
    caption: { top: 830, left: 60, right: 60, fontSize: 44 },
    persona: { top: 30, left: 0, right: 0 },
    endCard: { top: 470, left: 0, right: 0, headlineSize: 72, phone: { scale: 0.42, center: { x: 540, y: 250 } } },
  },
  "16:9": {
    format: "16:9",
    window: "phone",
    frame: { width: 1920, height: 1080 },
    screenBox: { centerX: 600, top: 90, maxWidth: 640, maxHeight: 900 },
    cameraTarget: { x: 600, y: 500 },
    caption: { top: 700, left: 1100, right: 120, fontSize: 50 },
    persona: { top: 150, left: 1100, right: 120 },
    endCard: { top: 330, left: 1100, right: 120, headlineSize: 80, phone: { scale: 0.85, center: { x: 600, y: 540 } } },
  },
  desktop: {
    format: "16:9",
    window: "browser",
    frame: { width: 1920, height: 1080 },
    screenBox: { centerX: 960, top: 180, maxWidth: 1600, maxHeight: 840 },
    cameraTarget: { x: 960, y: 570 },
    caption: { top: 890, left: 260, right: 260, fontSize: 50 },
    persona: { top: 14, left: 0, right: 0 },
    endCard: { top: 330, left: 1080, right: 100, headlineSize: 80, phone: { scale: 0.5, center: { x: 560, y: 540 } } },
  },
};

/** The height of the browser window's bar (dots and address), drawn above the desktop screen box. */
export const BROWSER_BAR_HEIGHT = 52;

/** The layout a film composes in: `desktop` for a desktop device, else its format's. */
export function getLayoutName(format: VideoFormat, deviceKind: DeviceKind): LayoutName {
  return deviceKind === "desktop" ? "desktop" : format;
}

/**
 * What a project may change in a layout: the caption box and font size, the persona card's box, the end card's box,
 * headline size and the pose of the phone (or the browser window) behind it. A missing (or undefined) key keeps the table's value.
 */
export interface LayoutOverride {
  caption?: Partial<CaptionLayout>;
  persona?: Partial<TextBox>;
  endCard?: Partial<TextBox> & { headlineSize?: number; phone?: { scale?: number; center?: Partial<Point> } };
}

function mergeTextBox(base: TextBox, override: Partial<TextBox> = {}): TextBox {
  return { top: override.top ?? base.top, left: override.left ?? base.left, right: override.right ?? base.right };
}

/** A layout with a project's override merged in, key by key; always fresh objects, never the table's. */
export function resolveLayout(name: LayoutName, override: LayoutOverride = {}): Layout {
  const base = LAYOUTS[name];
  const endCard = override.endCard ?? {};
  const phone = endCard.phone ?? {};
  return {
    format: base.format,
    window: base.window,
    frame: { ...base.frame },
    screenBox: { ...base.screenBox },
    cameraTarget: { ...base.cameraTarget },
    caption: { ...mergeTextBox(base.caption, override.caption), fontSize: override.caption?.fontSize ?? base.caption.fontSize },
    persona: mergeTextBox(base.persona, override.persona),
    endCard: {
      ...mergeTextBox(base.endCard, endCard),
      headlineSize: endCard.headlineSize ?? base.endCard.headlineSize,
      phone: {
        scale: phone.scale ?? base.endCard.phone.scale,
        center: { x: phone.center?.x ?? base.endCard.phone.center.x, y: phone.center?.y ?? base.endCard.phone.center.y },
      },
    },
  };
}

export interface Geometry {
  layout: LayoutName;
  format: VideoFormat;
  window: WindowKind;
  frame: { width: number; height: number };
  /** The recorded device's CSS viewport. */
  viewport: Viewport;
  /** Where the recorded screen sits in the frame. */
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
  const { screenBox } = LAYOUTS["9:16"];
  return (viewport.height * screenBox.maxWidth) / viewport.width <= screenBox.maxHeight;
}

/** The narrowest desktop viewport, in CSS px: below it most apps switch to their tablet or phone layout. */
export const MIN_DESKTOP_WIDTH = 1024;

/** Whether a viewport is a desktop browser's: at least `MIN_DESKTOP_WIDTH` wide and landscape (or square). */
export function isDesktopViewport(viewport: Viewport): boolean {
  return viewport.width >= MIN_DESKTOP_WIDTH && viewport.height <= viewport.width;
}

/**
 * A layout for a recorded device, with the project's override of that layout. A phone recorder uses the 9:16
 * default without an override: its camera scales are relative to the screen and serve every format, and no
 * override changes the frame or the screen box it reads. A desktop recorder uses `desktop`.
 */
export function getGeometry(viewport: Viewport, name: LayoutName = "9:16", override: LayoutOverride = {}): Geometry {
  const layout = resolveLayout(name, override);
  const { screenBox } = layout;
  const width = Math.min(screenBox.maxWidth, Math.floor((screenBox.maxHeight * viewport.width) / viewport.height));
  const screenScale = width / viewport.width;
  return {
    layout: name,
    format: layout.format,
    window: layout.window,
    frame: layout.frame,
    viewport: { ...viewport },
    screen: { left: Math.round(screenBox.centerX - width / 2), top: screenBox.top, width },
    screenScale,
    screenHeight: Math.round(viewport.height * screenScale),
    cameraTarget: layout.cameraTarget,
    caption: layout.caption,
    persona: layout.persona,
    endCard: layout.endCard,
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
 * Camera pose (scale + offset of the layer holding the phone or window, origin in the top left corner) that
 * puts the centre of a page rectangle on `target`.
 */
export function cameraPose(geometry: Geometry, rect: Rect, scale: number, target: Point = geometry.cameraTarget): CameraPose {
  const { screen, screenScale } = geometry;
  const centerX = screen.left + screenScale * (rect.x + rect.w / 2);
  const centerY = screen.top + screenScale * (rect.y + rect.h / 2);
  return { scale, x: round(target.x - scale * centerX), y: round(target.y - scale * centerY) };
}

/** The whole screen in the frame, kept where the layout puts it (its centre stays in place). */
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
