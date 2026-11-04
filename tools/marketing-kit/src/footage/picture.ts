import { getSegmentScales } from "./compose.js";
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
 * into the incoming clip (`xfade`), as the per-segment composition plays it. Zoom cuts and Ken Burns stay tweens on
 * the composition's video.
 */

/** The point a zoom keeps still, as the composition's `transform-origin: 50% 42%`. */
const ZOOM_ORIGIN = { x: 0.5, y: 0.42 } as const;
/** How far a segment marked `kenburns` zooms when the film's `kenBurnsPercent` is 0, as in the composition. */
const HAND_KEN_BURNS_PERCENT = 4;
const PICTURE_CRF = 18;
const DEFAULT_PICTURE_PRESET = "veryfast";

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/** The outgoing segment's tail under a cross-fade. */
export interface PictureFadeTail {
  clip: string;
  /** Seconds in the clip: where the outgoing segment ends. */
  start: number;
  frames: number;
  /** The zoom the outgoing segment ends on, held through the fade. */
  scale: number;
}

/** One segment's piece of the picture. */
export interface PicturePiece {
  clip: string;
  /** Seconds in the clip where the piece starts. */
  start: number;
  /** The piece's first film frame. */
  frame: number;
  frames: number;
  /** For a `fade` cut, the outgoing tail the piece dissolves from; null for any other cut. */
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
    const fadeFrames = segment.transition === "fade" ? Math.min(frames, edit.fadeFrames) : 0;
    let fade: PictureFadeTail | null = null;
    if (previous !== undefined && fadeFrames > 0) {
      const previousScale = scales[index - 1] as number;
      // The outgoing segment's Ken Burns tween ends at its end; its tail holds the zoom it reached.
      const scale = previous.motion === "kenburns" ? Math.round(previousScale * kenBurnsScale * 10000) / 10000 : previousScale;
      fade = { clip: previous.clip, start: r3(previous.end), frames: fadeFrames, scale };
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
 * A crop to `scale` about the zoom origin and back to the clip's `frame`; nothing at scale 1. The crop rounds, so
 * scaling it by the factor could come back a pixel or two short of the incoming clip, which `xfade` refuses (#1057).
 */
function zoomFilters(scale: number, frame: Frame): string[] {
  if (scale === 1) return [];
  return [`crop=iw/${scale}:ih/${scale}:(iw-iw/${scale})*${ZOOM_ORIGIN.x}:(ih-ih/${scale})*${ZOOM_ORIGIN.y}`, `scale=${frame.width}:${frame.height}`];
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
    const tail = [...zoomFilters(fade.scale, input.frame), ...fitStream(fade.frames)];
    graph = [
      `[0:v]${fitStream(piece.frames).join(",")}[incoming]`,
      `[1:v]${tail.join(",")}[outgoing]`,
      // xfade's output is the outgoing tail plus the incoming piece minus the fade: the piece's own length.
      `[outgoing][incoming]xfade=transition=fade:duration=${r3(fade.frames / FOOTAGE_FPS)}:offset=0,trim=end_frame=${piece.frames}[picture]`,
    ].join(";");
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

/** The concat demuxer's list: one `file` line per piece, quotes escaped as the demuxer reads them. */
export function buildPictureList(files: readonly string[]): string {
  return `${files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n")}\n`;
}

/** Joins the pieces by stream copy (they share one encoder's settings) into the picture, fast start. */
export function buildPictureConcatArgs(list: string, output: string): string[] {
  return ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", output];
}
