import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { MarketingConfig } from "../config/config.js";
import type { Film } from "../film.js";
import {
  buildTtsRequest,
  readTimestampsResponse,
  voiceoverKey,
  voiceoverText,
  wordsFromAlignment,
  type TimedWord,
} from "../voice/voiceover.js";
import { fail } from "./failure.js";

export interface Voiceover {
  audio: string;
  words: TimedWord[];
}

export function getVoiceoverPaths(config: MarketingConfig, film: Film) {
  const key = voiceoverKey(voiceoverText(film.beats), film.voice.voiceId, film.voice.modelId, film.voice.language);
  return { key, audio: join(config.voice.cacheDir, `${key}.mp3`), words: join(config.voice.cacheDir, `${key}.json`) };
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

/** JSON from disk with the file name in the error, not a bare "Unexpected token". */
export function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    fail(`cannot read ${path}: ${String(error)}.`);
  }
}

export function findCachedVoiceover(config: MarketingConfig, film: Film): Voiceover | null {
  const paths = getVoiceoverPaths(config, film);
  if (!existsSync(paths.audio) || !existsSync(paths.words)) return null;
  const words = readJson(paths.words);
  if (!isTimedWords(words)) fail(`${paths.words} is not a list of timed words.`);
  return { audio: paths.audio, words };
}

export function requireVoiceover(config: MarketingConfig, film: Film): Voiceover {
  const cached = findCachedVoiceover(config, film);
  if (cached === null) fail(`no voiceover for "${film.id}": run softure-marketing voice ${film.id} --commit first.`);
  return cached;
}

/**
 * The voiceover from the cache, or a paid ElevenLabs recording with `--commit`. Without `--commit`
 * it only counts the characters and spends nothing (returns null).
 */
export async function produceVoiceover(config: MarketingConfig, film: Film, isCommit: boolean): Promise<Voiceover | null> {
  const paths = getVoiceoverPaths(config, film);
  const cached = findCachedVoiceover(config, film);
  if (cached !== null) {
    console.log(`voiceover: from the cache ${paths.key}, nothing spent.`);
    return cached;
  }
  const text = voiceoverText(film.beats);
  if (!isCommit) {
    console.log(
      `voiceover DRY RUN: ${text.length} ElevenLabs characters (voice ${film.voice.voiceId}). Nothing was sent.\n` +
        `To pay and record: ELEVENLABS_API_KEY=... softure-marketing voice ${film.id} --commit`,
    );
    return null;
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) fail("no ELEVENLABS_API_KEY in the environment.");
  const request = buildTtsRequest(text, film.voice.voiceId, film.voice.modelId, film.voice.language);
  let response: Response;
  try {
    response = await fetch(request.url, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
    });
  } catch (error) {
    fail(`ElevenLabs: the connection failed (${String(error)}).`);
  }
  if (!response.ok) {
    const detail = await response.text().catch((error: unknown) => `(unreadable body: ${String(error)})`);
    fail(`ElevenLabs answered ${response.status}: ${detail.slice(0, 300)}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    fail(`ElevenLabs: the response is not JSON (${String(error)}).`);
  }
  const parsed = readTimestampsResponse(body);
  const words = wordsFromAlignment(parsed.alignment);
  mkdirSync(config.voice.cacheDir, { recursive: true });
  writeFileSync(paths.audio, parsed.audio);
  writeFileSync(paths.words, `${JSON.stringify(words, null, 1)}\n`);
  console.log(`voiceover: spent ${text.length} characters, saved ${paths.key}.{mp3,json} in ${config.voice.cacheDir} (commit them).`);
  return { audio: paths.audio, words };
}
