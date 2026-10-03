import { createHash } from "node:crypto";

import type { Beat } from "../film.js";

/**
 * ElevenLabs voiceover with timestamps: captions and the pace of the actions on screen come from the
 * moment each word is spoken.
 *
 * REST `/with-timestamps`, not MCP: the MCP server's `text_to_speech` tool returns no timestamps
 * and speaks `language: "en"` by default.
 */

export const ELEVENLABS_API_URL = "https://api.elevenlabs.io";
export const ELEVENLABS_DEFAULT_MODEL = "eleven_multilingual_v2";
const OUTPUT_FORMAT = "mp3_44100_128";

export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

export interface CharacterAlignment {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

export interface TtsRequest {
  url: string;
  body: {
    text: string;
    model_id: string;
    language_code: string;
    voice_settings: { stability: number; similarity_boost: number; style: number; speed: number };
  };
}

/** The full voiceover text: sentences joined with a space; the cache key depends on it. */
export function voiceoverText(beats: Beat[]): string {
  return beats.map((beat) => beat.text.trim()).join(" ");
}

/**
 * Key of a paid recording in the voiceover cache. A different text, voice, model or language is a
 * new recording; the tempo is **not** part of the key. The hashed shape is FIRE_TRACKER's, so its
 * paid recordings (language `pl`) keep their keys.
 */
export function voiceoverKey(text: string, voiceId: string, modelId: string, language: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ text, voice: voiceId, model: modelId, lang: language }))
    .digest("hex")
    .slice(0, 16);
}

export function buildTtsRequest(text: string, voiceId: string, modelId: string, language: string): TtsRequest {
  return {
    url: `${ELEVENLABS_API_URL}/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${OUTPUT_FORMAT}`,
    body: {
      text,
      model_id: modelId,
      // Without an explicit language, numbers and abbreviations are normalised as English.
      language_code: language,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, speed: 1 },
    },
  };
}

function isNumberList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** API response → audio and timestamps; the shape is checked because the data comes from outside. */
export function readTimestampsResponse(input: unknown): { audio: Buffer; alignment: CharacterAlignment } {
  if (typeof input !== "object" || input === null) {
    throw new Error("ElevenLabs: the response is not a JSON object.");
  }
  const record = input as Record<string, unknown>;
  if (typeof record.audio_base64 !== "string" || record.audio_base64.length === 0) {
    throw new Error("ElevenLabs: no audio_base64 in the response.");
  }
  const raw = record.alignment as Record<string, unknown> | null | undefined;
  if (
    typeof raw !== "object" ||
    raw === null ||
    !isStringList(raw.characters) ||
    !isNumberList(raw.character_start_times_seconds) ||
    !isNumberList(raw.character_end_times_seconds)
  ) {
    throw new Error("ElevenLabs: no timestamps (alignment) or an unexpected shape.");
  }
  return {
    audio: Buffer.from(record.audio_base64, "base64"),
    alignment: {
      characters: raw.characters,
      characterStartTimesSeconds: raw.character_start_times_seconds,
      characterEndTimesSeconds: raw.character_end_times_seconds,
    },
  };
}

// `|| 0` turns -0 (e.g. 1.65 / 1.1 - 1.5) into 0; otherwise toEqual sees a difference.
const round = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/** Timed characters → words (boundary: whitespace). */
export function wordsFromAlignment(alignment: CharacterAlignment): TimedWord[] {
  const { characters, characterStartTimesSeconds: starts, characterEndTimesSeconds: ends } = alignment;
  if (characters.length !== starts.length || characters.length !== ends.length) {
    throw new Error(
      `Voiceover timestamps: arrays of different lengths (characters ${characters.length}, start ${starts.length}, end ${ends.length}).`,
    );
  }
  const words: TimedWord[] = [];
  let current: TimedWord | null = null;
  characters.forEach((character, index) => {
    // The length check above keeps every index in range.
    const start = starts[index] as number;
    const end = ends[index] as number;
    if (/\s/.test(character)) {
      if (current !== null) words.push(current);
      current = null;
      return;
    }
    if (current === null) {
      current = { text: character, start, end };
      return;
    }
    current.text += character;
    current.end = end;
  });
  if (current !== null) words.push(current);
  return words.map((word) => ({ text: word.text, start: round(word.start), end: round(word.end) }));
}

export interface BeatVoice {
  id: string;
  /** Start and end of the sentence in the recording **after** the tempo change, in seconds. */
  start: number;
  end: number;
  /** Words timed from the start of the sentence, after the tempo change. */
  words: TimedWord[];
}

/**
 * Words of the whole recording → the script's sentences, with times divided by the tempo. The
 * word count must match exactly; otherwise the timestamps belong to another text and the captions
 * would drift from the voice.
 */
export function splitIntoBeats(words: TimedWord[], beats: Beat[], tempo: number): BeatVoice[] {
  const counts = beats.map((beat) => beat.text.trim().split(/\s+/).length);
  const expected = counts.reduce((sum, count) => sum + count, 0);
  if (expected !== words.length) {
    throw new Error(`The voiceover has ${words.length} words and the script ${expected}: the recording does not match the text.`);
  }
  let index = 0;
  return beats.map((beat, i) => {
    const count = counts[i] as number;
    const own = words.slice(index, index + count);
    index += count;
    const first = own[0] as TimedWord;
    const last = own[own.length - 1] as TimedWord;
    const start = round(first.start / tempo);
    return {
      id: beat.id,
      start,
      end: round(last.end / tempo),
      words: own.map((word) => ({
        text: word.text,
        start: round(word.start / tempo - start),
        end: round(word.end / tempo - start),
      })),
    };
  });
}
