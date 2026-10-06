import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { err, ok, type TtsInput, type TtsRecording, type TtsResult } from "./provider.js";
import { voiceoverKey, type TimedWord } from "./voiceover.js";

export interface VoiceoverPaths {
  key: string;
  audio: string;
  words: string;
  /** `video`: in the video's own folder; `flat`: `<key>.*` in the cache root, the layout before 0.1.6, still read. */
  layout: "video" | "flat";
}

/** A voiceover on disk: the audio file's path and the timed words. */
export interface Voiceover {
  audio: string;
  words: TimedWord[];
}

function getPathsIn(dir: string, key: string, layout: VoiceoverPaths["layout"]): VoiceoverPaths {
  return { key, audio: join(dir, `${key}.mp3`), words: join(dir, `${key}.json`), layout };
}

function hasRecording(paths: VoiceoverPaths): boolean {
  return existsSync(paths.audio) && existsSync(paths.words);
}

/**
 * Where a recording of this input lives in the cache. With a video id: `<cacheDir>/<video-id>/<key>.mp3|json`, so
 * a reader sees which film a paid file belongs to; a recording saved flat by an earlier version
 * (`<cacheDir>/<key>.*`) is still found when the video's folder has none, so no paid file is recorded twice.
 * Without a video id: the flat layout. The key (text, voice, model, language) is the same in both.
 */
export function getVoiceoverPaths(cacheDir: string, input: TtsInput, videoId?: string): VoiceoverPaths {
  const key = voiceoverKey(input.text, input.voiceId, input.model, input.language);
  const flat = getPathsIn(cacheDir, key, "flat");
  if (videoId === undefined) return flat;
  const own = getPathsIn(join(cacheDir, videoId), key, "video");
  return hasRecording(own) || !hasRecording(flat) ? own : flat;
}

/** Recordings in the video's folder other than `key`: what an earlier script of the film paid for. Sorted file names. */
export function findStaleVoiceovers(cacheDir: string, videoId: string, key: string): string[] {
  const dir = join(cacheDir, videoId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".mp3") && name !== `${key}.mp3`)
    .sort();
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
  mkdirSync(dirname(paths.audio), { recursive: true });
  writeFileSync(paths.audio, recording.audio);
  writeFileSync(paths.words, `${JSON.stringify(recording.words, null, 1)}\n`);
  return { audio: paths.audio, words: recording.words };
}
