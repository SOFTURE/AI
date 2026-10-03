import { ok, type TtsEstimate, type TtsInput, type TtsProvider, type TtsRecording, type TtsResult } from "./provider.js";
import type { TimedWord } from "./voiceover.js";

export interface FakeTtsOptions {
  /** Seconds each word lasts; words follow each other with a tenth of that as a gap. */
  wordSeconds?: number;
  /** Makes `synthesize` fail with this message, to test error paths. */
  failWith?: string;
}

export interface FakeTtsProvider extends TtsProvider {
  /** Every input `synthesize` received, in order. */
  readonly calls: TtsInput[];
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * A provider that spends nothing and needs no network: the audio is the text's bytes and the words
 * are evenly spaced. For tests of the pipeline and of a project's own scenes.
 */
export function createFakeTtsProvider(options: FakeTtsOptions = {}): FakeTtsProvider {
  const wordSeconds = options.wordSeconds ?? 0.4;
  const calls: TtsInput[] = [];

  function estimate(input: TtsInput): TtsEstimate {
    return { characters: input.text.length, maxCost: 0, unit: "fake credits" };
  }

  function synthesize(input: TtsInput): Promise<TtsResult<TtsRecording>> {
    calls.push(input);
    if (options.failWith !== undefined) return Promise.resolve({ ok: false, error: options.failWith });
    const step = wordSeconds * 1.1;
    const words: TimedWord[] = input.text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .map((text, index) => ({ text, start: round(index * step), end: round(index * step + wordSeconds) }));
    return Promise.resolve(ok({ audio: Buffer.from(`fake audio: ${input.text}`), words }));
  }

  return { id: "fake", calls, estimate, synthesize };
}
