import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { err, ok, type TtsInput, type TtsRecording, type TtsResult } from "./provider.js";
import { voiceoverKey, type TimedWord } from "./voiceover.js";

export interface VoiceoverPaths {
  key: string;
  audio: string;
  words: string;
}

/** A voiceover on disk: the audio file's path and the timed words. */
export interface Voiceover {
  audio: string;
  words: TimedWord[];
}

/** Where a recording of this input lives in the cache: `<key>.mp3` and `<key>.json`. */
export function getVoiceoverPaths(cacheDir: string, input: TtsInput): VoiceoverPaths {
  const key = voiceoverKey(input.text, input.voiceId, input.model, input.language);
  return { key, audio: join(cacheDir, `${key}.mp3`), words: join(cacheDir, `${key}.json`) };
}

function isTimedWords(value: unknown): value is TimedWord[] {
  return (
    Array.isArray(value) &&
    value.every((item: unknown) => {
      if (typeof item !== "object" || item === null) return false;
      const word = item as Record<string, unknown>;
      return typeof word.text === "string" && typeof word.start === "number" && typeof word.end === "number";
    })
  );
}

/** The cached voiceover, null when either file is missing, or an error naming a broken words file. */
export function readCachedVoiceover(paths: VoiceoverPaths): TtsResult<Voiceover | null> {
  if (!existsSync(paths.audio) || !existsSync(paths.words)) return ok(null);
  let words: unknown;
  try {
    words = JSON.parse(readFileSync(paths.words, "utf8")) as unknown;
  } catch (error) {
    return err(`cannot read ${paths.words}: ${String(error)}.`);
  }
  if (!isTimedWords(words)) return err(`${paths.words} is not a list of timed words.`);
  return ok({ audio: paths.audio, words });
}

/** Writes a recording in FIRE_TRACKER's format, so files recorded there stay byte-identical. */
export function writeVoiceover(cacheDir: string, paths: VoiceoverPaths, recording: TtsRecording): Voiceover {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(paths.audio, recording.audio);
  writeFileSync(paths.words, `${JSON.stringify(recording.words, null, 1)}\n`);
  return { audio: paths.audio, words: recording.words };
}
