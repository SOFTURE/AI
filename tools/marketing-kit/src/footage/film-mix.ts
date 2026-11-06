import type { FootageSfxCue } from "./compose.js";
import { FOOTAGE_SAMPLE_RATE } from "./normalize.js";

/**
 * The film's sound mixed by ffmpeg as the composition plays it (every element from its start, at its volume, for its
 * duration, summed without normalization), so the mix stage can bring it to the target and gate it before
 * hyperframes captures a frame (issue #1124). The finished film carries this mix, not the render's own sound.
 */

export interface FilmMixInput {
  /** The speech track and how long it plays (the cut's length). */
  speech: { file: string; seconds: number };
  /** The ducked music track and how long it plays (the film's length); null for none. */
  music: { file: string; seconds: number } | null;
  /** The sound effects, their `src` a file ffmpeg can read. */
  sfx: readonly FootageSfxCue[];
  /** The film's length: the mix is padded with silence or cut to it. */
  seconds: number;
  /** A WAV file (32-bit float, 48 kHz stereo). */
  output: string;
}

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/**
 * The ffmpeg arguments that write the film's mix. The length is bounded three times (the padding's `whole_dur`, the
 * trim and the output's `-t`): a mix that once ran unbounded on CI wrote a 90 GB WAV and filled the disk, so no single
 * filter's end of stream is trusted with it. A film length that is not a positive number is a bug and throws.
 */
export function buildFilmMixArgs(input: FilmMixInput): string[] {
  if (!Number.isFinite(input.seconds) || input.seconds <= 0) throw new Error(`buildFilmMixArgs: the film's length must be a positive number of seconds, got ${String(input.seconds)}.`);
  const length = String(r3(input.seconds));
  const format = `aresample=${FOOTAGE_SAMPLE_RATE},aformat=sample_fmts=fltp:channel_layouts=stereo`;
  const sources: { file: string; filter: string }[] = [
    { file: input.speech.file, filter: `atrim=duration=${r3(input.speech.seconds)},${format}` },
    ...(input.music === null ? [] : [{ file: input.music.file, filter: `atrim=duration=${r3(input.music.seconds)},${format}` }]),
    ...input.sfx.map((cue) => ({
      file: cue.src,
      filter: `atrim=duration=${r3(cue.dur)},${format},volume=${cue.volume},adelay=delays=${Math.round(cue.t * 1000)}:all=1`,
    })),
  ];
  const chains = sources.map((source, index) => `[${index}:a]${source.filter}[a${index}]`);
  const labels = sources.map((_, index) => `[a${index}]`).join("");
  const mixed = sources.length === 1 ? `[a0]anull` : `${labels}amix=inputs=${sources.length}:duration=longest:normalize=0`;
  const graph = [...chains, `${mixed},apad=whole_dur=${length},atrim=duration=${length}[mix]`].join(";");
  return [
    "-v",
    "error",
    "-y",
    ...sources.flatMap((source) => ["-i", source.file]),
    "-filter_complex",
    graph,
    "-map",
    "[mix]",
    "-t",
    length,
    "-c:a",
    "pcm_f32le",
    "-ar",
    String(FOOTAGE_SAMPLE_RATE),
    "-ac",
    "2",
    input.output,
  ];
}
