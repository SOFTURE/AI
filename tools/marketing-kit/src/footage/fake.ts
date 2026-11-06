import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { err, ok, type TtsResult } from "../voice/provider.js";
import type { TimedWord } from "../voice/voiceover.js";
import { probeAudio } from "./audio.js";
import type { IsolationProvider, MusicProvider, SttInput, SttProvider, SttTranscript } from "./providers.js";

/** Providers that spend nothing and reach no network, for tests of the footage pipeline and of a project's own flows. */

export interface FakeSttOptions {
  /** Words per audio file, by the file's name up to its first dot (the pipeline names a clip's audio `<clip id>.*`). */
  transcripts?: Record<string, TimedWord[]>;
  /** Makes every call fail with this message. */
  failWith?: string;
  /** The charge every call reports, as a provider whose API returns one. */
  credits?: number;
}

export interface FakeSttProvider extends SttProvider {
  readonly calls: SttInput[];
}

export function createFakeSttProvider(options: FakeSttOptions = {}): FakeSttProvider {
  const calls: SttInput[] = [];
  return {
    id: "fake",
    model: "fake-stt",
    calls,
    transcribe(input): Promise<TtsResult<SttTranscript>> {
      calls.push(input);
      if (options.failWith !== undefined) return Promise.resolve({ ok: false, error: options.failWith });
      const name = basename(input.audio).split(".")[0] ?? "";
      const transcript = { words: options.transcripts?.[name] ?? [], language: input.language };
      return Promise.resolve(ok(options.credits === undefined ? transcript : { ...transcript, credits: options.credits }));
    },
  };
}

export interface FakeIsolationOptions {
  /**
   * The shortest input in seconds the fake accepts, declared as its `minSeconds`: a shorter input (probed with
   * ffprobe) is refused with `audio_too_short`, as the ElevenLabs Voice Isolator refuses it.
   */
  minSeconds?: number;
}

export interface FakeIsolationProvider extends IsolationProvider {
  readonly calls: string[];
  /** The inputs refused for being shorter than `minSeconds`. */
  readonly refused: string[];
}

/** Returns the input file's bytes unchanged: a valid audio file, so a pipeline with it still renders. */
export function createFakeIsolationProvider(options: FakeIsolationOptions = {}): FakeIsolationProvider {
  const calls: string[] = [];
  const refused: string[] = [];
  const { minSeconds } = options;
  return {
    id: "fake",
    ...(minSeconds === undefined ? {} : { minSeconds }),
    calls,
    refused,
    async isolate(input) {
      calls.push(input.audio);
      if (minSeconds !== undefined) {
        const probed = await probeAudio(input.audio, input.signal === undefined ? {} : { signal: input.signal });
        if (!probed.ok) return err(`fake voice isolation: ${probed.error}`);
        if (probed.probe.duration < minSeconds) {
          refused.push(input.audio);
          const message = `${probed.probe.duration.toFixed(3)} s, the minimum is ${String(minSeconds)} s`;
          return err(`fake voice isolation: 400 audio_too_short (${message}).`, { kind: "refused", status: 400, code: "audio_too_short", message, requestId: null, isRetryable: false });
        }
      }
      return ok(readFileSync(input.audio));
    },
  };
}

export interface FakeMusicProvider extends MusicProvider {
  readonly calls: ({ kind: "compose"; prompt: string; seconds: number } | { kind: "video"; video: string; description: string; tags: string[] })[];
}

/** Returns `audio` (by default a few bytes that are not audio: enough for tests that never decode it). */
export function createFakeMusicProvider(audio: Buffer = Buffer.from("fake music")): FakeMusicProvider {
  const calls: FakeMusicProvider["calls"] = [];
  return {
    id: "fake",
    model: "fake-music",
    calls,
    compose(input) {
      calls.push({ kind: "compose", ...input });
      return Promise.resolve(ok(audio));
    },
    scoreVideo(input) {
      calls.push({ kind: "video", ...input });
      return Promise.resolve(ok(audio));
    },
  };
}

const round = (value: number): number => Math.round(value * 1000) / 1000 || 0;
/** Silence kept before the first and after the last placeholder word. */
const PLACEHOLDER_MARGIN = 0.3;

/**
 * The free stand-in transcript of `--placeholder`: the script's words spread evenly over the clip, each lasting 80 %
 * of its slot. No script, no words: the clip is kept whole.
 */
export function makePlaceholderTranscript(script: string | null, duration: number): TimedWord[] {
  const texts = (script ?? "").trim().split(/\s+/).filter((text) => text.length > 0);
  const span = duration - 2 * PLACEHOLDER_MARGIN;
  if (texts.length === 0 || span <= 0) return [];
  const slot = span / texts.length;
  return texts.map((text, index) => {
    const start = PLACEHOLDER_MARGIN + index * slot;
    return { text, start: round(start), end: round(start + slot * 0.8) };
  });
}
