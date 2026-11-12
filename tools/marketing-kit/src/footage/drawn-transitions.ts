import type { Frame } from "./normalize.js";
import { FOOTAGE_FPS } from "./normalize.js";

/**
 * Drawn transitions between two shots, the same frames in the draft (`draft.ts`) and the render's picture
 * (`picture.ts`): both give the outgoing segment a tail that plays on under the incoming one, as a dissolve does, and
 * blend the tail with the incoming head through `buildDrawnTransitionFilters`. Nothing is taken from outside the code:
 * the paper's grain is ffmpeg's noise, its torn edge a sum of sines.
 *
 * - `whip`: the outgoing shot slides left faster and faster under a growing horizontal blur (8 frames), the incoming
 *   one slides in from the right still blurred, lands from 110 % and comes sharp (6 frames). No sound of its own.
 * - `card`: the incoming shot appears in the middle as a small card (a quarter of the frame, tilted 3°, rounded
 *   corners) and grows over the outgoing one until it fills the frame, eased out.
 * - `paper`: a paper grain settles over the outgoing shot (4 frames), then a torn edge opens from the middle onto the
 *   incoming one (8 frames).
 *
 * The `stutter` is not drawn here: it is a scale (the first `STUTTER_FRAMES` frames at the full frame, then the
 * segment's tight framing), set where the other zooms are (`getSegmentScales`, the draft's zoom).
 */

export const DRAWN_TRANSITIONS = ["whip", "card", "paper"] as const;

export type DrawnTransition = (typeof DRAWN_TRANSITIONS)[number];

/** Each drawn transition's length in frames at 30 fps (the reference reels, measured). */
export const DRAWN_TRANSITION_FRAMES: Readonly<Record<DrawnTransition, number>> = { whip: 14, card: 13, paper: 12 };

/** The whip's outgoing half; the rest of its frames are the incoming shot landing. */
export const WHIP_OUT_FRAMES = 8;

/** The paper's grain fade-in over the outgoing shot, before the tear opens. */
export const PAPER_FADE_FRAMES = 4;

/** How many frames a stutter shows the full frame before its tight framing. */
export const STUTTER_FRAMES = 5;

/** The stutter's tight framing when the segment sets no camera of its own. */
export const STUTTER_SCALE = 1.5;

/** How far the whip slides on each side, as a share of the frame's width. */
const WHIP_TRAVEL = 0.6;
/** The whip's horizontal blur on its outgoing frames, as a share of the frame's width (0: sharp). */
const WHIP_OUT_BLUR = [0, 0, 0, 0.002, 0.006, 0.014, 0.028, 0.05] as const;
/** The whip's blur on its incoming frames, falling to sharp. */
const WHIP_IN_BLUR = [0.042, 0.022, 0.01, 0.004, 0.0015, 0] as const;
/** The whip's landing zoom on the incoming shot. */
const WHIP_LANDING_SCALE = 1.1;

/** The card's first size (a share of the frame), tilt in radians (3°) and corner radius (a share of the width). */
const CARD_START_SCALE = 0.25;
const CARD_START_TILT = 0.0524;
const CARD_CORNER = 0.035;

/** The paper's colour, how strongly its grain multiplies the outgoing shot, how far the tear opens and its rim. */
const PAPER_COLOR = "0xEDE6D8";
const PAPER_STRENGTH = 0.55;
const PAPER_OPEN = 0.62;
const PAPER_RIM = 0.012;
/** The torn edge across the height: a sum of sines (amplitude as a share of the width, frequency, phase). */
const PAPER_TEAR: readonly (readonly [number, number, number])[] = [
  [0.035, 31, 1.3],
  [0.02, 83, 0.7],
  [0.012, 197, 2.1],
  [0.006, 421, 0.4],
];
/** The paper's white at the torn rim (luma, limited range). */
const PAPER_RIM_LUMA = 232;

const r4 = (value: number): number => Math.round(value * 10000) / 10000 || 0;

/** Whether a transition is one of the drawn ones. */
export function isDrawnTransition(transition: string): transition is DrawnTransition {
  return (DRAWN_TRANSITIONS as readonly string[]).includes(transition);
}

/** The frames the outgoing segment plays on under the incoming one: a fade's own or the film's, a drawn transition's own, else 0. */
export function getTransitionOverlapFrames(segment: { transition: string; fadeFrames?: number | undefined }, filmFadeFrames: number): number {
  if (segment.transition === "fade") return segment.fadeFrames ?? filmFadeFrames;
  return isDrawnTransition(segment.transition) ? DRAWN_TRANSITION_FRAMES[segment.transition] : 0;
}

export interface DrawnTransitionFiltersInput {
  kind: DrawnTransition;
  /** The outgoing tail's label: exactly the transition's frames, the frame's size, yuv420p at 30 fps. */
  outgoing: string;
  /** The incoming head's label, the same. */
  incoming: string;
  /** The label the blended frames go out on (as many frames, yuv420p, 30 fps). */
  output: string;
  frame: Frame;
  /** A prefix for the graph's inner labels, unique in the graph. */
  prefix: string;
}

/** The filter chains (to join with `;`) that blend an outgoing tail and an incoming head into the transition's frames. */
export function buildDrawnTransitionFilters(input: DrawnTransitionFiltersInput): string[] {
  switch (input.kind) {
    case "whip":
      return buildWhipFilters(input);
    case "card":
      return buildCardFilters(input);
    case "paper":
      return buildPaperFilters(input);
  }
}

/**
 * The film's time base with every frame numbered on it, after a `trim`, a blend or a `concat`: each frame then has its
 * place, so a `concat` lays the pieces end to end. (An `fps` filter here drops the last frame of a stream whose frames
 * carry no duration, as `overlay`, `blend` and `interleave` leave them.)
 */
export const FRAME_TIMING = `settb=1/${FOOTAGE_FPS},setpts=N`;

/** The closing filters every transition ends on: the film's pixel format, square pixels and frame rate. */
function closeStream(): string {
  return `format=yuv420p,setsar=1,${FRAME_TIMING}`;
}

/** One `gblur` per frame of `sigmas` (shares of the width), horizontal only, on that frame alone; none for a sharp frame. */
function blurSteps(sigmas: readonly number[], width: number): string[] {
  return sigmas.flatMap((share, frame) => (share > 0 ? [`gblur=sigma=${r4(share * width)}:sigmaV=0:enable='eq(n,${String(frame)})'`] : []));
}

function buildWhipFilters(input: DrawnTransitionFiltersInput): string[] {
  const { width: w, height: h } = input.frame;
  const p = input.prefix;
  const inFrames = DRAWN_TRANSITION_FRAMES.whip - WHIP_OUT_FRAMES;
  const last = WHIP_OUT_FRAMES - 1;
  const land = inFrames - 1;
  // The slide wraps the shot around (a strip of the shot beside itself), so the blur streaks never show an edge.
  const out = [`hstack`, `crop=w=${w}:h=${h}:x='${w}*${WHIP_TRAVEL}*pow(n/${last},2)':y=0`, ...blurSteps(WHIP_OUT_BLUR, w), "setpts=PTS-STARTPTS", FRAME_TIMING];
  const into = [
    `hstack`,
    `crop=w=${w}:h=${h}:x='${w}*(1-${WHIP_TRAVEL}*pow(1-(n+1)/${inFrames},2))':y=0`,
    `zoompan=z='${WHIP_LANDING_SCALE}-${r4(WHIP_LANDING_SCALE - 1)}*(1-pow(1-on/${land},2))':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=${w}x${h}:fps=${FOOTAGE_FPS}`,
    ...blurSteps(WHIP_IN_BLUR, w),
    "setpts=PTS-STARTPTS",
    FRAME_TIMING,
  ];
  return [
    `[${input.outgoing}]trim=end_frame=${WHIP_OUT_FRAMES},setpts=PTS-STARTPTS,split[${p}o1][${p}o2]`,
    `[${p}o1][${p}o2]${out.join(",")}[${p}out]`,
    `[${input.incoming}]trim=start_frame=${WHIP_OUT_FRAMES}:end_frame=${DRAWN_TRANSITION_FRAMES.whip},setpts=PTS-STARTPTS,split[${p}i1][${p}i2]`,
    `[${p}i1][${p}i2]${into.join(",")}[${p}in]`,
    `[${p}out][${p}in]concat=n=2:v=1:a=0,${closeStream()}[${input.output}]`,
  ];
}

/** The card's size, tilt and corner on frame `k` (0-based) of `frames`, eased out (`1 - (1 - t)^2`) to the full frame. */
export function getCardFrame(k: number, frames: number = DRAWN_TRANSITION_FRAMES.card): { scale: number; tilt: number; corner: number } {
  const eased = 1 - (1 - (k + 1) / frames) ** 2;
  return { scale: r4(CARD_START_SCALE + (1 - CARD_START_SCALE) * eased), tilt: r4(CARD_START_TILT * (1 - eased)), corner: r4(CARD_CORNER * (1 - eased)) };
}

/** An even size of at least 2 px, as yuv420p needs. */
function toEven(value: number): number {
  return Math.max(2, 2 * Math.floor(value / 2));
}

function buildCardFilters(input: DrawnTransitionFiltersInput): string[] {
  const { width: w, height: h } = input.frame;
  const p = input.prefix;
  const frames = DRAWN_TRANSITION_FRAMES.card;
  // Each frame is its own chain at a fixed size: a size that changes mid-stream breaks `geq` and `rotate`.
  const labels = Array.from({ length: frames }, (_, k) => `${p}c${String(k)}`);
  const chains = labels.map((label, k) => {
    const { scale, tilt, corner } = getCardFrame(k, frames);
    const radius = r4(corner * w);
    const chain = [`trim=start_frame=${String(k)}:end_frame=${String(k + 1)}`, `scale=${String(toEven(w * scale))}:${String(toEven(h * scale))}`];
    if (radius >= 0.5) {
      chain.push(`geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='255*lte(hypot(max(0,abs(X-W/2)-(W/2-${radius})),max(0,abs(Y-H/2)-(H/2-${radius}))),${radius})'`);
    }
    if (tilt > 0) chain.push(`rotate=${tilt}:c=none:ow=rotw(${tilt}):oh=roth(${tilt})`);
    chain.push(`pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black@0`, "setsar=1");
    return `[${p}s${String(k)}]${chain.join(",")}[${label}]`;
  });
  return [
    `[${input.incoming}]trim=end_frame=${frames},setpts=PTS-STARTPTS,format=yuva420p,split=${frames}${labels.map((_, k) => `[${p}s${String(k)}]`).join("")}`,
    ...chains,
    // One-frame chains keep their own times, so `interleave` lays them out in order (a `concat` of them drops frames).
    `${labels.map((label) => `[${label}]`).join("")}interleave=nb_inputs=${frames}[${p}card]`,
    `[${input.outgoing}]trim=end_frame=${frames},setpts=PTS-STARTPTS,format=yuv420p[${p}under]`,
    `[${p}under][${p}card]overlay=0:0:format=auto,${closeStream()}[${input.output}]`,
  ];
}

/** The paper's tear: a sum of sines along the height, as a share of the width (the `blend` expression's `Y` and `H`). */
function getTearExpression(): string {
  return `(${PAPER_TEAR.map(([amplitude, frequency, phase]) => `${amplitude}*sin(Y/H*${frequency}+${phase})`).join("+")})`;
}

/** How far the tear has opened on frame `N` (the `blend` expression's frame), as a share of the width; closed during the grain's fade. */
function getOpenExpression(frames: number): string {
  const opening = frames - PAPER_FADE_FRAMES;
  return `if(lt(N,${PAPER_FADE_FRAMES}),-1,${PAPER_OPEN}*(0.5-0.5*cos(PI*(N-${PAPER_FADE_FRAMES}+1)/${opening})))`;
}

function buildPaperFilters(input: DrawnTransitionFiltersInput): string[] {
  const { width: w, height: h } = input.frame;
  const p = input.prefix;
  const frames = DRAWN_TRANSITION_FRAMES.paper;
  const strength = `min(1,(N+1)/${PAPER_FADE_FRAMES})*${PAPER_STRENGTH}`;
  // Below 0 inside the tear (the incoming shot), up to the rim the torn paper's white, beyond it the papered shot.
  const edge = `(abs(X/W-0.5)-(${getOpenExpression(frames)})-${getTearExpression()})`;
  const tear = (rim: number): string => `'if(lt(${edge},0),A,if(lt(${edge},${PAPER_RIM}),${String(rim)},B))'`;
  return [
    // A static grain (no temporal noise) softened more along the height, as paper fibres run.
    `color=c=${PAPER_COLOR}:s=${w}x${h}:r=${FOOTAGE_FPS},trim=end_frame=${frames},format=yuv420p,noise=c0s=28:c0f=a,gblur=sigma=${r4(Math.max(0.6, w / 900))}:sigmaV=${r4(Math.max(1.5, w / 360))}[${p}grain]`,
    `[${input.outgoing}]trim=end_frame=${frames},setpts=PTS-STARTPTS,format=yuv420p[${p}under]`,
    `[${input.incoming}]trim=end_frame=${frames},setpts=PTS-STARTPTS,format=yuv420p[${p}over]`,
    `[${p}under][${p}grain]blend=c0_expr='A*(1-${strength})+A*B/255*${strength}':c1_expr='A*(1-${strength})+B*${strength}':c2_expr='A*(1-${strength})+B*${strength}'[${p}papered]`,
    `[${p}over][${p}papered]blend=c0_expr=${tear(PAPER_RIM_LUMA)}:c1_expr=${tear(128)}:c2_expr=${tear(128)},${closeStream()}[${input.output}]`,
  ];
}
