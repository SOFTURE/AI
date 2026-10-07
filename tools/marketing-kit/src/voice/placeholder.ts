import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Voiceover } from "./cache.js";
import type { TimedWord } from "./voiceover.js";

/**
 * A free stand-in for the paid voiceover, so a film can be recorded and rendered end to end before anyone pays
 * (`all`/`record`/`render --placeholder`): every word at a fixed pace, a pause between sentences, and a quiet tone as
 * the audio. It lives in the film's build folder under its own key, never in `voice.cacheDir`: a placeholder in the
 * cache would be a cache hit for the real key, so the paid recording would never be made.
 */

export interface PlaceholderPace {
  /** Words spoken per second (`voice.placeholder.wordsPerSecond`). */
  wordsPerSecond: number;
  /** Silence after every sentence but the last (`voice.placeholder.sentencePauseSeconds`). */
  sentencePauseSeconds: number;
}

/** The key a recording made on the placeholder carries in its log, so it never renders with the real voiceover. */
export const PLACEHOLDER_KEY_PREFIX = "placeholder-";

/** Silence before the first word and after the last, so the tone does not start or end on a word. */
const LEAD_SECONDS = 0.1;
const TAIL_SECONDS = 0.5;
/** A word ends a little before the next starts, as in a real recording's timings. */
const WORD_GAP_SECONDS = 0.05;
const TONE_HZ = 220;
const TONE_VOLUME = 0.05;

const round = (value: number): number => Math.round(value * 1000) / 1000;

export function getPlaceholderKey(voiceoverKey: string): string {
  return `${PLACEHOLDER_KEY_PREFIX}${voiceoverKey}`;
}

export function isPlaceholderKey(key: string | undefined): boolean {
  return key?.startsWith(PLACEHOLDER_KEY_PREFIX) ?? false;
}

/** The words of the script, evenly paced, with a pause after every sentence; the shape the provider returns. */
export function makePlaceholderWords(sentences: { text: string }[], pace: PlaceholderPace): TimedWord[] {
  const wordSeconds = 1 / pace.wordsPerSecond;
  const words: TimedWord[] = [];
  let time = LEAD_SECONDS;
  sentences.forEach((sentence, index) => {
    for (const text of sentence.text.trim().split(/\s+/).filter((word) => word.length > 0)) {
      words.push({ text, start: round(time), end: round(time + wordSeconds - WORD_GAP_SECONDS) });
      time += wordSeconds;
    }
    if (index < sentences.length - 1) time += pace.sentencePauseSeconds;
  });
  return words;
}

/** How long the placeholder's audio lasts: past the last word by the tail. */
export function getPlaceholderSeconds(words: TimedWord[]): number {
  return round((words.at(-1)?.end ?? 0) + TAIL_SECONDS);
}

export interface WritePlaceholderOptions {
  /** The folder of the placeholder's files: `<output.buildDir>/<video>/placeholder/`. */
  dir: string;
  sentences: { text: string }[];
  pace: PlaceholderPace;
}

/** Writes `voiceover.json` (the words) and `voiceover.mp3` (a quiet tone as long as them); needs ffmpeg in PATH. */
export function writePlaceholderVoiceover(options: WritePlaceholderOptions): Voiceover {
  const words = makePlaceholderWords(options.sentences, options.pace);
  mkdirSync(options.dir, { recursive: true });
  const audio = join(options.dir, "voiceover.mp3");
  const seconds = getPlaceholderSeconds(words);
  const tone = ["-v", "error", "-y", "-f", "lavfi", "-i", `sine=frequency=${TONE_HZ}:duration=${seconds}`, "-filter:a", `volume=${TONE_VOLUME}`];
  const result = spawnSync("ffmpeg", [...tone, "-c:a", "libmp3lame", "-q:a", "6", audio], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`ffmpeg could not write the placeholder voiceover ${audio}: ${result.error?.message ?? result.stderr.trim()}`);
  }
  writeFileSync(join(options.dir, "voiceover.json"), `${JSON.stringify(words, null, 1)}\n`);
  return { audio, words };
}
