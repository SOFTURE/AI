import { CAMERA_ORIGIN, getCameraOrigin, type CameraAnchor } from "./camera.js";
import { getSegmentScales } from "./compose.js";
import { buildDrawnTransitionFilters, FRAME_TIMING, getTransitionOverlapFrames, isDrawnTransition, type DrawnTransition } from "./drawn-transitions.js";
import { getEdlDuration, getSegmentStarts, type Edl } from "./edl.js";
import { getFootageEdit, type FootageFilm } from "./film.js";
import { FOOTAGE_FPS, getThreadArgs, type Frame, type NormalizeEncoder } from "./normalize.js";

/**
 * The cut's picture in film time, which the render's composition plays as one `<video>`: one short ffmpeg per segment
 * (run one after the other, so one decoder at a time) and a stream-copy join. hyperframes then extracts the whole
 * film's frames with one ffmpeg, and its Chrome holds one video instead of one per segment (issue #1030: the
 * extraction peak falls from about 1 GB to 0.2 GB, the capture's from 1.7 GB to 1.1 GB on a 45 s 1080x1920 film).
 *
 * Every piece starts on a film frame and runs to the next segment's frame, so rounding never adds up along the cut.
 * A cross-fade is drawn into the incoming piece: the outgoing segment's tail, held at the zoom it ends on, dissolves
 * into the incoming clip (`xfade`), as the per-segment composition plays it. A drawn transition (`whip`, `card`,
 * `paper`) takes the same tail and blends it with the piece's head (`buildDrawnTransitionFilters`), as the draft does.
 * Zoom cuts and Ken Burns stay tweens on the composition's video.
 */

/** How far a segment marked `kenburns` zooms when the film's `kenBurnsPercent` is 0, as in the composition. */
const HAND_KEN_BURNS_PERCENT = 4;
const PICTURE_CRF = 18;
const DEFAULT_PICTURE_PRESET = "veryfast";

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;
const r4 = (value: number): number => Math.round(value * 10000) / 10000 || 0;

/** The outgoing segment's tail under a cross-fade or a drawn transition. */
export interface PictureFadeTail {
  /** How the tail meets the piece: a drawn transition of exactly `frames`; absent: a dissolve. */
  kind?: DrawnTransition;
  clip: string;
  /** Seconds in the clip: where the outgoing segment ends. */
  start: number;
  frames: number;
  /** The zoom the outgoing segment ends on, held through the fade. */
  scale: number;
  /** The point that zoom keeps still: the outgoing segment's camera anchor; absent: the composition's origin. */
  origin?: CameraAnchor;
}

/** One segment's piece of the picture. */
export interface PicturePiece {
  clip: string;
  /** Seconds in the clip where the piece starts. */
  start: number;
  /** The piece's first film frame. */
  frame: number;
  frames: number;
  /** For a `fade` cut or a drawn transition, the outgoing tail the piece starts over; null for any other cut. */
  fade: PictureFadeTail | null;
}

/** The film frame a film second falls on. */
function toFrame(seconds: number): number {
  return Math.round(seconds * FOOTAGE_FPS);
}

/** The picture's pieces, one per segment, covering the cut's frames without a gap. Throws on an EDL without segments. */
export function planFootagePicture(film: Pick<FootageFilm, "edit">, edl: Edl): PicturePiece[] {
  if (edl.segments.length === 0) throw new Error("The EDL has no segments.");
  const edit = getFootageEdit(film);
  const kenBurnsScale = 1 + (edit.kenBurnsPercent > 0 ? edit.kenBurnsPercent : HAND_KEN_BURNS_PERCENT) / 100;
  const scales = getSegmentScales(edl, edit.zoomPercent);
  const starts = getSegmentStarts(edl);
  const lastFrame = toFrame(getEdlDuration(edl));
  return edl.segments.map((segment, index) => {
    const frame = toFrame(starts[index] as number);
    const nextStart = starts[index + 1];
    const frames = Math.max(1, (nextStart === undefined ? lastFrame : toFrame(nextStart)) - frame);
    const previous = edl.segments[index - 1];
    const overlap = index === 0 ? 0 : getTransitionOverlapFrames(segment, edit.fadeFrames);
    const kind = segment.transition === "fade" ? "fade" : isDrawnTransition(segment.transition) ? segment.transition : null;
    // A dissolve fits the piece; a drawn transition has its own frames, and a piece too short for them (the EDL check
    // refuses one) plays a plain cut.
    const fadeFrames = kind === "fade" ? Math.min(frames, overlap) : kind !== null && overlap < frames ? overlap : 0;
    let fade: PictureFadeTail | null = null;
    if (previous !== undefined && kind !== null && fadeFrames > 0) {
      const previousScale = scales[index - 1] as number;
      // The outgoing segment's Ken Burns tween or camera move ends by its end; its tail holds the zoom it reached.
      const reached = previous.camera !== undefined ? previous.camera.to : previous.motion === "kenburns" ? r4(previousScale * kenBurnsScale) : previousScale;
      // The composition zooms the whole picture to the incoming camera's start during the fade, so a camera's tail is
      // baked at what is left of its zoom (never below the full frame: a fade into a tighter camera is a hard cut's job).
      const isCamera = previous.camera !== undefined || segment.camera !== undefined;
      const scale = isCamera ? r4(Math.max(1, reached / (scales[index] as number))) : reached;
      fade = { ...(kind === "fade" ? {} : { kind }), clip: previous.clip, start: r3(previous.end), frames: fadeFrames, scale, origin: getCameraOrigin(previous.camera) };
    }
    return { clip: segment.clip, start: r3(segment.start), frame, frames, fade };
  });
}

/** The number of frames the picture has: the cut's length in film frames. */
export function getPictureFrames(pieces: readonly PicturePiece[]): number {
  return pieces.reduce((sum, piece) => sum + piece.frames, 0);
}

/**
 * Filters that bring a stream to the film's rate and pixel format and exactly `frames` long (a short clip holds its
 * last frame). The closing `fps` states the frame rate again: ffmpeg 7.1's `setpts` leaves it unknown (1/0), which
 * `xfade` refuses (issue #1057); on a stream already at the film's rate it passes every frame through.
 */
function fitStream(frames: number): string[] {
  const seconds = r3(frames / FOOTAGE_FPS);
  return [
    "setpts=PTS-STARTPTS",
    `fps=${FOOTAGE_FPS}`,
    "format=yuv420p",
    "setsar=1",
    `tpad=stop_mode=clone:stop_duration=${seconds}`,
    `trim=end_frame=${frames}`,
    "setpts=PTS-STARTPTS",
    `settb=1/${FOOTAGE_FPS}`,
    `fps=${FOOTAGE_FPS}`,
  ];
}

/**
 * A crop to `scale` about `origin` and back to the clip's `frame`; nothing at scale 1. The crop rounds, so
 * scaling it by the factor could come back a pixel or two short of the incoming clip, which `xfade` refuses (#1057).
 */
function zoomFilters(scale: number, frame: Frame, origin: CameraAnchor): string[] {
  if (scale === 1) return [];
  return [`crop=iw/${scale}:ih/${scale}:(iw-iw/${scale})*${origin.x}:(ih-ih/${scale})*${origin.y}`, `scale=${frame.width}:${frame.height}`];
}

export interface PicturePieceArgsInput {
  piece: PicturePiece;
  /** The normalized clips by id. */
  clips: Record<string, string>;
  /** The normalized clips' frame (the film's, `getFrame`): a zoomed fade tail is scaled back to it. */
  frame: Frame;
  output: string;
  /** The intermediate clips' encoder (`RenderFootageOptions.normalize`): its preset and threads encode the piece too. */
  encoder?: NormalizeEncoder;
}

/** One piece's ffmpeg arguments: its clip (and a fade's outgoing tail), exactly `frames` frames, H.264 without sound. */
export function buildPicturePieceArgs(input: PicturePieceArgsInput): string[] {
  const { piece, clips } = input;
  const getClip = (id: string): string => {
    const file = clips[id];
    if (file === undefined) throw new Error(`No file for clip "${id}" of the EDL.`);
    return file;
  };
  const threads = getThreadArgs(input.encoder?.threads, "normalize.threads");
  const seconds = (frames: number): string => String(r3(frames / FOOTAGE_FPS + 1 / FOOTAGE_FPS));
  const inputs = [...threads.output, "-ss", String(piece.start), "-t", seconds(piece.frames), "-i", getClip(piece.clip)];
  let graph = `[0:v]${fitStream(piece.frames).join(",")}[picture]`;
  if (piece.fade !== null) {
    const { fade } = piece;
    inputs.push(...threads.output, "-ss", String(fade.start), "-t", seconds(fade.frames), "-i", getClip(fade.clip));
    const tail = [...zoomFilters(fade.scale, input.frame, fade.origin ?? CAMERA_ORIGIN), ...fitStream(fade.frames)];
    graph = fade.kind === undefined ? [
      `[0:v]${fitStream(piece.frames).join(",")}[incoming]`,
      `[1:v]${tail.join(",")}[outgoing]`,
      // xfade's output is the outgoing tail plus the incoming piece minus the fade: the piece's own length.
      `[outgoing][incoming]xfade=transition=fade:duration=${r3(fade.frames / FOOTAGE_FPS)}:offset=0,trim=end_frame=${piece.frames}[picture]`,
    ].join(";") : buildDrawnPieceGraph({ kind: fade.kind, piece, tail, frame: input.frame });
  }
  return [
    "-v",
    "error",
    "-y",
    ...threads.global,
    ...inputs,
    "-filter_complex",
    graph,
    "-map",
    "[picture]",
    "-an",
    "-frames:v",
    String(piece.frames),
    "-c:v",
    "libx264",
    "-preset",
    input.encoder?.preset ?? DEFAULT_PICTURE_PRESET,
    "-crf",
    String(PICTURE_CRF),
    "-g",
    String(FOOTAGE_FPS / 2),
    "-pix_fmt",
    "yuv420p",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    ...threads.output,
    input.output,
  ];
}

/**
 * A piece that starts on a drawn transition: its first `frames` blended with the outgoing tail, then the rest of its
 * own frames (the plan gives a drawn transition only to a piece longer than it).
 */
function buildDrawnPieceGraph(input: { kind: DrawnTransition; piece: PicturePiece; tail: string[]; frame: Frame }): string {
  const { piece } = input;
  const frames = piece.fade?.frames ?? 0;
  return [
    `[0:v]${fitStream(piece.frames).join(",")},split[full1][full2]`,
    `[full1]trim=end_frame=${frames},setpts=PTS-STARTPTS,${FRAME_TIMING}[incoming]`,
    `[full2]trim=start_frame=${frames},setpts=PTS-STARTPTS,${FRAME_TIMING}[rest]`,
    `[1:v]${input.tail.join(",")}[outgoing]`,
    ...buildDrawnTransitionFilters({ kind: input.kind, outgoing: "outgoing", incoming: "incoming", output: "blend", frame: input.frame, prefix: "dt" }),
    `[blend][rest]concat=n=2:v=1:a=0,settb=1/${FOOTAGE_FPS},fps=${FOOTAGE_FPS}[picture]`,
  ].join(";");
}

/** The concat demuxer's list: one `file` line per piece, quotes escaped as the demuxer reads them. */
export function buildPictureList(files: readonly string[]): string {
  return `${files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n")}\n`;
}

/** Joins the pieces by stream copy (they share one encoder's settings) into the picture, fast start. */
export function buildPictureConcatArgs(list: string, output: string): string[] {
  return ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", output];
}
