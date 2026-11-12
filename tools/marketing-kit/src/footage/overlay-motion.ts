import type { OverlayEasing, OverlayEntrance, OverlayExit } from "./overlay-schema.js";

/**
 * How a drawn overlay moves in and out (RV-133 of an adopting app): one model the render's GSAP tweens and the draft's
 * ASS tags both read, so the two stay one look. Every curve eases out without overshoot: a value travels from its
 * start to its rest and never past it, so no element grows past 100 % (`getEntranceScaleAt`). No bounce, no elastic.
 */

/** A GSAP ease name and its curve: each one rises from 0 to 1 and never passes 1. */
export const OVERLAY_EASES = {
  "power2.out": (t: number) => 1 - (1 - t) ** 2,
  "power3.out": (t: number) => 1 - (1 - t) ** 3,
  "expo.out": (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  "power2.in": (t: number) => t ** 2,
} as const;

export type OverlayEase = keyof typeof OVERLAY_EASES;

/** How far from its rest an overlay starts or ends: its opacity, its scale, px below its place, px of blur. */
export interface OverlayMotionOffset {
  opacity: number;
  scale: number;
  y: number;
  blur: number;
}

/** A tweened entrance: from `from` to rest over `seconds` along `ease`. */
export interface OverlayTween {
  from: OverlayMotionOffset;
  seconds: number;
  ease: OverlayEase;
}

/** The entrance of an overlay: tweened, a wipe (accent in, then the card and its text), or none (simply there). */
export type OverlayEntranceMotion = ({ kind: "tween" } & OverlayTween) | { kind: "wipe"; seconds: number; ease: OverlayEase } | { kind: "none" };

/** The exit of an overlay: tweened to `from` over its last `seconds`, wiped off to the right, the kind's own, or none. */
export type OverlayExitMotion = ({ kind: "tween" } & OverlayTween) | { kind: "wipe"; seconds: number; ease: OverlayEase } | { kind: "own" } | { kind: "none" };

/** A pop's start scale: 92 % of its size. */
export const POP_FROM_SCALE = 0.92;
/** A pop's exit scale: it shrinks to 96 % as it fades. */
const POP_EXIT_SCALE = 0.96;
/** A rise starts this share of the frame's height below its place (4 to 6 %). */
export const RISE_FROM_HEIGHT = 0.05;
/** A blur's start, in px of a 1080 px wide frame. */
export const BLUR_FROM_PX = 14;
/** A slide's start below its place, in px of a 1080 px wide frame. */
const SLIDE_FROM_PX = 28;
/** A slide exit's travel down, in px of a 1080 px wide frame. */
const SLIDE_EXIT_PX = 14;
/** The seconds of an exit (smooth). */
export const OVERLAY_EXIT_SECONDS = 0.3;
/** How much quicker a snappy curve runs. */
const SNAPPY_SPEED = 0.7;

const REST: OverlayMotionOffset = { opacity: 1, scale: 1, y: 0, blur: 0 };
const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/** The smooth entrances' offsets, seconds and eases; `scale` is the frame's width / 1080, `height` its height. */
function getSmoothEntrance(entrance: Exclude<OverlayEntrance, "none" | "wipe">, frame: { scale: number; height: number }): OverlayTween {
  switch (entrance) {
    case "fade":
      return { from: { ...REST, opacity: 0 }, seconds: 0.4, ease: "power2.out" };
    // A dropped text's card (or highlight) fades in quickly; its letters fall in on their own (`getDropOffsetAt`).
    case "drop":
    case "type":
      return { from: { ...REST, opacity: 0 }, seconds: 0.25, ease: "power2.out" };
    case "slide":
      return { from: { ...REST, opacity: 0, y: r3(SLIDE_FROM_PX * frame.scale) }, seconds: 0.5, ease: "power3.out" };
    case "pop":
      return { from: { ...REST, opacity: 0, scale: POP_FROM_SCALE }, seconds: 0.3, ease: "power2.out" };
    case "rise":
      return { from: { ...REST, opacity: 0, y: r3(RISE_FROM_HEIGHT * frame.height) }, seconds: 0.3, ease: "power3.out" };
    case "blur":
      return { from: { ...REST, opacity: 0, blur: r3(BLUR_FROM_PX * frame.scale) }, seconds: 0.3, ease: "power2.out" };
  }
}

/** A curve's seconds and ease for the easing: snappy runs 0.7 as long on `expo.out`. */
function withEasing<T extends { seconds: number; ease: OverlayEase }>(motion: T, easing: OverlayEasing): T {
  return easing === "snappy" ? { ...motion, seconds: r3(motion.seconds * SNAPPY_SPEED), ease: "expo.out" } : motion;
}

/** An overlay's entrance motion: `entrance` already resolved to a named one (the kind's own when the overlay names none). */
export function getEntranceMotion(entrance: OverlayEntrance, easing: OverlayEasing, frame: { width: number; height: number }): OverlayEntranceMotion {
  if (entrance === "none") return { kind: "none" };
  if (entrance === "wipe") return withEasing({ kind: "wipe" as const, seconds: 0.5, ease: "power3.out" }, easing);
  return withEasing({ kind: "tween" as const, ...getSmoothEntrance(entrance, { scale: frame.width / 1080, height: frame.height }) }, easing);
}

/**
 * An overlay's exit motion. `auto` mirrors its named entrance: a fade, a typed or a slid entrance leave by fading or
 * sliding down; a pop shrinks to 96 % as it fades; a rise sinks half its way; a blur blurs; a wipe is wiped off to the
 * right; no entrance (`entrance` null) or `none` leave the kind's own way (`own`), as before RV-133. Only `exit: none`
 * leaves at once.
 */
export function getExitMotion(input: { exit: OverlayExit; entrance: OverlayEntrance | null; easing: OverlayEasing; frame: { width: number; height: number } }): OverlayExitMotion {
  const { exit, entrance, easing, frame } = input;
  const scale = frame.width / 1080;
  const fade: OverlayTween = { from: { ...REST, opacity: 0 }, seconds: OVERLAY_EXIT_SECONDS, ease: "power2.in" };
  const slide: OverlayTween = { ...fade, from: { ...fade.from, y: r3(SLIDE_EXIT_PX * scale) } };
  const tween = (motion: OverlayTween): OverlayExitMotion => ({ kind: "tween", ...withEasing(motion, easing), ease: easing === "snappy" ? "power2.in" : motion.ease });
  if (exit === "none") return { kind: "none" };
  if (exit === "fade") return tween(fade);
  if (exit === "slide") return tween(slide);
  switch (entrance) {
    case null:
    case "none":
      return { kind: "own" };
    case "fade":
    case "type":
    case "drop":
      return tween(fade);
    case "slide":
      return tween(slide);
    case "pop":
      return tween({ ...fade, from: { ...fade.from, scale: POP_EXIT_SCALE } });
    case "rise":
      return tween({ ...fade, from: { ...fade.from, y: r3((RISE_FROM_HEIGHT / 2) * frame.height) } });
    case "blur":
      return tween({ ...fade, from: { ...fade.from, blur: r3((BLUR_FROM_PX / 1.4) * scale) } });
    case "wipe":
      return { kind: "wipe", seconds: easing === "snappy" ? r3(OVERLAY_EXIT_SECONDS * SNAPPY_SPEED) : OVERLAY_EXIT_SECONDS, ease: "power2.in" };
  }
}

/** The scale an entrance gives `seconds` after it starts: from its start scale up to 1, never past it. */
export function getEntranceScaleAt(motion: OverlayEntranceMotion, seconds: number): number {
  if (motion.kind !== "tween") return 1;
  const progress = Math.min(1, Math.max(0, seconds / motion.seconds));
  return motion.from.scale + (1 - motion.from.scale) * OVERLAY_EASES[motion.ease](progress);
}

/** A wipe's two halves: the accent panel grows from the left over the first, then slides off to the right over the second. */
export function getWipeHalves(seconds: number): { grow: number; reveal: number } {
  return { grow: r3(seconds / 2), reveal: r3(seconds / 2) };
}

/** A place card's pin drops this share of its own size before it stops, over these seconds. */
export const PIN_DROP_SHARE = 0.6;
export const PIN_DROP_SECONDS = 0.35;
/** A place card's title follows its pin by this long, so the pin comes first. */
export const PIN_TITLE_LEAD = 0.2;
/** A keyword's underline is drawn over these seconds, after its entrance. */
export const UNDERLINE_SECONDS = 0.35;
/** A keyword's underline: its thickness and its gap under the text, in em of the keyword. */
export const UNDERLINE_EM = { height: 0.09, gap: 0.05 } as const;

/**
 * The film seconds each point of a staggered list comes in at: on its word (`words`, the said times, never before the
 * list nor later than its last 0.6 s), else spaced over the first part of its span (0.25 to 0.6 s apart).
 */
export function getListItemStarts(input: { start: number; end: number; count: number; words?: readonly number[] }): number[] {
  const { start, end, count } = input;
  const latest = Math.max(start, end - 0.6);
  if (input.words !== undefined) return input.words.map((word) => r3(Math.min(latest, Math.max(start, word))));
  const gap = Math.min(0.6, Math.max(0.25, ((end - start) * 0.4) / count));
  return Array.from({ length: count }, (_item, index) => r3(Math.min(latest, start + 0.2 + index * gap)));
}

/** A dropped letter falls from this share of its line's type size above its place. */
export const DROP_FROM_EM = 0.3;
/** The seconds one letter falls, and the seconds between two letters' starts (2 frames at 30 fps). */
export const DROP_LETTER_SECONDS = 0.3;
export const DROP_LETTER_GAP = 0.067;
/** The most a letter is turned when it starts falling, in degrees; it turns back to straight as it lands. */
export const DROP_MAX_TURN = 8;

/**
 * The film seconds each letter of a dropped text starts falling at (a space takes no turn of its own): the first at
 * `start`, each next one `DROP_LETTER_GAP` later.
 */
export function getDropLetterTimes(start: number, text: string): number[] {
  let letter = 0;
  return [...text].map((char) => {
    const at = r3(start + letter * DROP_LETTER_GAP);
    if (char.trim() !== "") letter += 1;
    return at;
  });
}

/** The turn each letter starts with, in degrees: alternating sides, between half and all of `DROP_MAX_TURN`. */
export function getDropLetterTurns(text: string): number[] {
  return [...text].map((_char, index) => r3((index % 2 === 0 ? -1 : 1) * DROP_MAX_TURN * (0.5 + 0.5 * (((index * 7) % 5) / 4))));
}

/**
 * A dropped letter `seconds` after it starts falling: px above its place (negative y, up), its turn and its opacity.
 * The fall eases out along `power2.out`, so the letter slows into its place and never passes it: y stays at or above 0
 * (screen y grows down), and the turn shrinks to 0 without changing sides.
 */
export function getDropOffsetAt(seconds: number, input: { fontSize: number; turn: number }): { y: number; turn: number; opacity: number } {
  const progress = Math.min(1, Math.max(0, seconds / DROP_LETTER_SECONDS));
  const eased = OVERLAY_EASES["power2.out"](progress);
  return { y: r3(-DROP_FROM_EM * input.fontSize * (1 - eased)), turn: r3(input.turn * (1 - eased)), opacity: r3(Math.min(1, progress * 2)) };
}

/** A note strip grows from this share of its size over these seconds (8 frames at 30 fps), eased out. */
export const NOTE_GROW_FROM_SCALE = 0.3;
export const NOTE_GROW_SECONDS = 0.267;
/** A note's tick is drawn over these seconds, this long after its last word. */
export const NOTE_TICK_SECONDS = 0.3;
export const NOTE_TICK_DELAY = 0.15;
/** A note card is there, empty, this long before its first word (one frame at 30 fps). */
export const NOTE_FIRST_WORD_LEAD = 0.034;
