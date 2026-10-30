import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { z } from "zod";

import { ELEVENLABS_API_KEY_ENV } from "../voice/elevenlabs.js";
import { err, ok, type TtsResult } from "../voice/provider.js";
import { ELEVENLABS_API_URL, type TimedWord } from "../voice/voiceover.js";
import type { IsolationProvider, MusicProvider, PaidAudio, SttProvider, SttTranscript } from "./providers.js";

/**
 * ElevenLabs behind the footage providers (API reference checked 2026-10-29): Scribe speech to text
 * (`/v1/speech-to-text`, word timestamps), Voice Isolator (`/v1/audio-isolation`), Music (`/v1/music`) and Video to
 * Music (`/v1/music/video-to-music`). Each takes an injected `fetch`, so tests reach no network, and passes the
 * caller's `signal` to it. A `character-cost` header, when a response carries one, becomes the call's `credits`.
 */

export const ELEVENLABS_STT_MODEL = "scribe_v2";
export const ELEVENLABS_MUSIC_MODEL = "music_v1";
const ERROR_DETAIL_LENGTH = 300;
/** ElevenLabs Music takes 3 s to 10 min. */
const MUSIC_MIN_MS = 3000;
const MUSIC_MAX_MS = 600_000;

export interface ElevenLabsFootageOptions {
  /** The API key; a missing one fails the call, never the estimate. */
  apiKey: string | undefined;
  fetch?: typeof globalThis.fetch;
  /** Scribe's model; `scribe_v2` by default. */
  sttModel?: string;
  musicModel?: string;
}

const scribeSchema = z.looseObject({
  language_code: z.string().optional(),
  words: z.array(z.looseObject({ text: z.string(), start: z.number().nullish(), end: z.number().nullish(), type: z.string().optional() })),
});

const round = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/** Scribe's response read as timed words: entries of type `word` only (no spacing, no sound events). */
export function readScribeResponse(body: unknown, language: string): TtsResult<SttTranscript> {
  const parsed = scribeSchema.safeParse(body);
  if (!parsed.success) return err("ElevenLabs speech to text: the response has no words list.");
  const words: TimedWord[] = [];
  for (const word of parsed.data.words) {
    if ((word.type ?? "word") !== "word") continue;
    const text = word.text.trim();
    if (text.length === 0 || word.start == null || word.end == null) continue;
    words.push({ text, start: round(word.start), end: round(word.end) });
  }
  return ok({ words, language: parsed.data.language_code ?? language });
}

function fileBlob(path: string): Blob {
  return new Blob([readFileSync(path)]);
}

async function send(options: ElevenLabsFootageOptions, label: string, path: string, init: RequestInit): Promise<TtsResult<Response>> {
  if (options.apiKey === undefined || options.apiKey.length === 0) return err(`no ${ELEVENLABS_API_KEY_ENV} in the environment.`);
  const request = options.fetch ?? globalThis.fetch;
  let response: Response;
  try {
    response = await request(`${ELEVENLABS_API_URL}${path}`, { ...init, headers: { ...init.headers, "xi-api-key": options.apiKey } });
  } catch (error) {
    return err(`ElevenLabs ${label}: the connection failed (${String(error)}).`);
  }
  if (!response.ok) {
    const detail = await response.text().catch((error: unknown) => `(unreadable body: ${String(error)})`);
    return err(`ElevenLabs ${label} answered ${response.status}: ${detail.slice(0, ERROR_DETAIL_LENGTH)}`);
  }
  return ok(response);
}

/** The charge a response reports in its `character-cost` header; undefined when it reports none. */
export function readReportedCredits(response: Response): number | undefined {
  const header = response.headers.get("character-cost");
  if (header === null || header.trim().length === 0) return undefined;
  const credits = Number(header);
  return Number.isFinite(credits) ? credits : undefined;
}

const withCredits = <T extends object>(value: T, credits: number | undefined): T & { credits?: number } => (credits === undefined ? value : { ...value, credits });

async function readAudio(label: string, response: Response): Promise<TtsResult<PaidAudio>> {
  try {
    const audio = Buffer.from(await response.arrayBuffer());
    return audio.length > 0 ? ok(withCredits({ audio }, readReportedCredits(response))) : err(`ElevenLabs ${label}: the response has no audio.`);
  } catch (error) {
    return err(`ElevenLabs ${label}: reading the audio failed (${String(error)}).`);
  }
}

export function createElevenLabsSttProvider(options: ElevenLabsFootageOptions): SttProvider {
  const model = options.sttModel ?? ELEVENLABS_STT_MODEL;
  return {
    id: "elevenlabs",
    model,
    async transcribe(input) {
      const form = new FormData();
      form.append("model_id", model);
      form.append("file", fileBlob(input.audio), basename(input.audio));
      form.append("language_code", input.language);
      form.append("timestamps_granularity", "word");
      form.append("tag_audio_events", "false");
      const response = await send(options, "speech to text", "/v1/speech-to-text", { method: "POST", body: form, signal: input.signal ?? null });
      if (!response.ok) return response;
      let body: unknown;
      try {
        body = (await response.value.json()) as unknown;
      } catch (error) {
        return err(`ElevenLabs speech to text: the response is not JSON (${String(error)}).`);
      }
      const transcript = readScribeResponse(body, input.language);
      return transcript.ok ? ok(withCredits(transcript.value, readReportedCredits(response.value))) : transcript;
    },
  };
}

export function createElevenLabsIsolationProvider(options: ElevenLabsFootageOptions): IsolationProvider {
  return {
    id: "elevenlabs",
    async isolate(input) {
      const form = new FormData();
      form.append("audio", fileBlob(input.audio), basename(input.audio));
      const response = await send(options, "voice isolation", "/v1/audio-isolation", { method: "POST", body: form, signal: input.signal ?? null });
      return response.ok ? readAudio("voice isolation", response.value) : response;
    },
  };
}

/** The length ElevenLabs Music is asked for: the film's, within the service's 3 s to 10 min. */
export function getMusicLengthMs(seconds: number): number {
  return Math.min(MUSIC_MAX_MS, Math.max(MUSIC_MIN_MS, Math.ceil(seconds * 1000)));
}

export function createElevenLabsMusicProvider(options: ElevenLabsFootageOptions): MusicProvider {
  const model = options.musicModel ?? ELEVENLABS_MUSIC_MODEL;
  return {
    id: "elevenlabs",
    model,
    async compose(input) {
      const body = { prompt: input.prompt, music_length_ms: getMusicLengthMs(input.seconds), model_id: model, force_instrumental: true };
      const response = await send(options, "music", "/v1/music?output_format=mp3_44100_128", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: input.signal ?? null,
      });
      return response.ok ? readAudio("music", response.value) : response;
    },
    async scoreVideo(input) {
      const form = new FormData();
      form.append("videos", fileBlob(input.video), basename(input.video));
      if (input.description.length > 0) form.append("description", input.description);
      for (const tag of input.tags) form.append("tags", tag);
      const response = await send(options, "video to music", "/v1/music/video-to-music?output_format=mp3_44100_128", { method: "POST", body: form, signal: input.signal ?? null });
      return response.ok ? readAudio("video to music", response.value) : response;
    },
  };
}

/** The ElevenLabs footage providers with the key from the environment (read, never logged). */
export function createElevenLabsFootageProviders(env: Record<string, string | undefined>, fetch?: typeof globalThis.fetch) {
  const options: ElevenLabsFootageOptions = { apiKey: env[ELEVENLABS_API_KEY_ENV], ...(fetch === undefined ? {} : { fetch }) };
  return { stt: createElevenLabsSttProvider(options), isolation: createElevenLabsIsolationProvider(options), music: createElevenLabsMusicProvider(options) };
}
