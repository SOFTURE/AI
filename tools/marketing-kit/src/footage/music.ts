import type { TimedWord } from "../voice/voiceover.js";

/**
 * Music under the voice: loud between sentences, ducked while someone speaks. The envelope is a list of keyframes
 * computed from the film's word times; ffmpeg applies it to the music file (`volumeExpression`), so the composition
 * plays an already ducked track.
 */

export interface VolumeKeyframe {
  t: number;
  volume: number;
}

export interface DuckingOptions {
  /** The music's volume between sentences and under speech. */
  volume: number;
  duckedVolume: number;
  /** Seconds the music takes to go down before the first word, and to come back after the last. */
  attack?: number;
  release?: number;
  /** Two words closer than this stay one stretch of speech. */
  gap?: number;
}

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/** Stretches of speech: the words joined when less than `gap` seconds apart. */
export function getSpeechSpans(words: TimedWord[], gap: number): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  for (const word of [...words].sort((a, b) => a.start - b.start)) {
    const last = spans.at(-1);
    if (last !== undefined && word.start - last.end < gap) last.end = Math.max(last.end, word.end);
    else spans.push({ start: word.start, end: word.end });
  }
  return spans;
}

/**
 * The music's volume over time as keyframes (linear between them): `volume`, down to `duckedVolume` by the first word
 * of each stretch of speech, back up `release` seconds after its last word. Stretches too close for the music to
 * come back up merge.
 */
export function duckingKeyframes(words: TimedWord[], options: DuckingOptions): VolumeKeyframe[] {
  const attack = options.attack ?? 0.25;
  const release = options.release ?? 0.5;
  const spans = getSpeechSpans(words, Math.max(options.gap ?? 0.6, attack + release));
  const keyframes: VolumeKeyframe[] = [];
  const push = (t: number, volume: number) => {
    const time = r3(Math.max(0, t));
    const last = keyframes.at(-1);
    if (last !== undefined && time <= last.t) {
      last.volume = volume;
      return;
    }
    keyframes.push({ t: time, volume });
  };
  if (spans.length === 0 || (spans[0]?.start ?? 0) - attack > 0) push(0, options.volume);
  for (const span of spans) {
    push(span.start - attack, options.volume);
    push(span.start, options.duckedVolume);
    push(span.end, options.duckedVolume);
    push(span.end + release, options.volume);
  }
  return keyframes;
}

const n = (value: number): string => String(r3(value));

/**
 * An expression for ffmpeg's `volume` filter (`eval=frame`, time `t`): the keyframes as a sum of linear pieces, each
 * switched on by its own time window, so a long film needs no nesting.
 */
export function volumeExpression(keyframes: VolumeKeyframe[]): string {
  const first = keyframes[0];
  const last = keyframes.at(-1);
  if (first === undefined || last === undefined) return "1";
  const pieces = [`lt(t,${n(first.t)})*${n(first.volume)}`];
  keyframes.slice(0, -1).forEach((from, index) => {
    const to = keyframes[index + 1] as VolumeKeyframe;
    const slope = (to.volume - from.volume) / (to.t - from.t);
    const value = slope === 0 ? n(from.volume) : `(${n(from.volume)}+${String(Math.round(slope * 1e6) / 1e6)}*(t-${n(from.t)}))`;
    pieces.push(`gte(t,${n(from.t)})*lt(t,${n(to.t)})*${value}`);
  });
  pieces.push(`gte(t,${n(last.t)})*${n(last.volume)}`);
  return pieces.join("+");
}
