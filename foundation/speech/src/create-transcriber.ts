import { ok, systemClock, type Clock, type Ok } from "@softure-ai/core";
import type { SpeechErrorCode, SpeechFailure, SpeechPricing, SpeechUsageHook, Transcript } from "./contract.js";
import { createFfmpegNormalizer, type AudioInput, type AudioNormalizer, type NormalizedAudio } from "./ffmpeg.js";
import type { SpeechProvider } from "./providers.js";
import { stitchChunks, type ChunkTranscript } from "./stitch.js";

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_DURATION_SECONDS = 3 * 60 * 60;
const DEFAULT_CHUNK_SECONDS = 600;
const DEFAULT_OVERLAP_SECONDS = 3;
const SECONDS_PER_MINUTE = 60;

export interface TranscriberOptions {
  /** `groqProvider()`, `openAiProvider()`, `openAiCompatibleProvider({ … })`, or the app's own adapter. */
  readonly provider: SpeechProvider;
  /** Default: `createFfmpegNormalizer()`. */
  readonly normalizer?: AudioNormalizer;
  /** Model id → USD per minute of audio; a model without an entry has `costUsd: null`. */
  readonly pricing?: SpeechPricing;
  /** Called once after every call that sent audio to the provider, failures included; a throw propagates. */
  readonly onUsage?: SpeechUsageHook;
  /** Time limit of each provider request (one chunk). Default 120 000. */
  readonly timeoutMs?: number;
  /** Longer input is `speech.too_long` before anything is uploaded. Default 10 800 (3 hours). */
  readonly maxDurationSeconds?: number;
  /** Length of a chunk; 600 s of FLAC stays under a 25 MB upload limit. Default 600. */
  readonly chunkSeconds?: number;
  /** How much neighbouring chunks share, so a word on a boundary is heard whole once. Default 3. */
  readonly overlapSeconds?: number;
  readonly clock?: Clock;
}

export interface TranscribeRequest {
  readonly input: AudioInput;
  /** ISO 639-1 code (`"en"`, `"pl"`); without it the provider detects the language. */
  readonly language?: string;
  /** Vocabulary or style hints passed to every chunk (names, terms). */
  readonly prompt?: string;
  /** What the transcript is for (`"voice-note"`, `"clip-subtitles"`); reaches `onUsage` for a spend ledger. */
  readonly purpose: string;
  /** Passed to `onUsage` as given (e.g. `{ accountId }`). */
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface Transcriber {
  transcribe(request: TranscribeRequest): Promise<Ok<Transcript> | SpeechFailure>;
}

/** Creates the app's transcriber. Invalid options throw a `RangeError` naming the option. */
export function createTranscriber(options: TranscriberOptions): Transcriber {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxDurationSeconds = options.maxDurationSeconds ?? DEFAULT_MAX_DURATION_SECONDS;
  const chunkSeconds = options.chunkSeconds ?? DEFAULT_CHUNK_SECONDS;
  const overlapSeconds = options.overlapSeconds ?? DEFAULT_OVERLAP_SECONDS;
  assertPositive(timeoutMs, "timeoutMs");
  assertPositive(maxDurationSeconds, "maxDurationSeconds");
  assertPositive(chunkSeconds, "chunkSeconds");
  if (!Number.isFinite(overlapSeconds) || overlapSeconds < 0 || overlapSeconds * 2 >= chunkSeconds) {
    throw new RangeError("createTranscriber: overlapSeconds must be 0 or more and less than half of chunkSeconds");
  }
  for (const [model, price] of Object.entries(options.pricing ?? {})) {
    if (!Number.isFinite(price.usdPerMinute) || price.usdPerMinute < 0) {
      throw new RangeError(`createTranscriber: pricing["${model}"].usdPerMinute must be 0 or more`);
    }
  }
  const { provider } = options;
  const clock = options.clock ?? systemClock;
  let normalizer = options.normalizer;

  async function transcribe(request: TranscribeRequest): Promise<Ok<Transcript> | SpeechFailure> {
    if (request.purpose.trim() === "") throw new RangeError("transcribe: purpose must not be empty");
    const startedAt = clock.now();
    normalizer ??= createFfmpegNormalizer();
    const normalized = await normalizer.normalize(request.input, { maxDurationSeconds, chunkSeconds, overlapSeconds });
    if (!normalized.ok) return normalized;

    const audio = normalized.value;
    let outcome: Awaited<ReturnType<typeof transcribeChunks>>;
    try {
      outcome = await transcribeChunks(audio, request);
    } finally {
      await audio.dispose();
    }

    const costUsd = getCostUsd(outcome.billedSeconds);
    if (outcome.billedSeconds > 0 && options.onUsage !== undefined) {
      await options.onUsage({
        provider: provider.name,
        model: provider.model,
        seconds: outcome.billedSeconds,
        costUsd,
        outcome: outcome.failure === null ? "ok" : outcome.failure.error,
        purpose: request.purpose,
        durationMs: clock.now().getTime() - startedAt.getTime(),
        at: startedAt,
        attributes: request.attributes ?? {},
      });
    }
    if (outcome.failure !== null) return outcome.failure;

    const segments = stitchChunks(outcome.chunks);
    return ok({
      text: segments.map((segment) => segment.text).join(" "),
      language: outcome.language ?? request.language ?? null,
      durationSeconds: audio.durationSeconds,
      segments,
      provider: provider.name,
      model: provider.model,
      billedSeconds: outcome.billedSeconds,
      costUsd,
    });
  }

  /** Sends the chunks in order and stops at the first failure. */
  async function transcribeChunks(
    audio: NormalizedAudio,
    request: TranscribeRequest,
  ): Promise<{
    readonly chunks: ChunkTranscript[];
    readonly billedSeconds: number;
    readonly language: string | null;
    readonly failure: SpeechFailure | null;
  }> {
    const chunks: ChunkTranscript[] = [];
    let billedSeconds = 0;
    let language: string | null = null;
    const done = (failure: SpeechFailure | null) => ({ chunks, billedSeconds, language, failure });

    for (const chunk of audio.chunks) {
      const file = await chunk.read();
      if (file.bytes.byteLength > provider.maxUploadBytes) return done(refuse("speech.too_long"));
      const answer = await provider.transcribeChunk({
        ...file,
        timeoutMs,
        ...(request.language === undefined ? {} : { language: request.language }),
        ...(request.prompt === undefined ? {} : { prompt: request.prompt }),
      });
      if (!answer.ok) return done(answer);
      billedSeconds += chunk.end - chunk.start;
      language ??= answer.value.language;
      chunks.push({ start: chunk.start, end: chunk.end, text: answer.value.text, segments: answer.value.segments });
    }
    return done(null);
  }

  function getCostUsd(seconds: number): number | null {
    const price = options.pricing?.[provider.model];
    if (price === undefined) return null;
    return (seconds / SECONDS_PER_MINUTE) * price.usdPerMinute;
  }

  return { transcribe };
}

function refuse(code: Exclude<SpeechErrorCode, "speech.rate_limited">): SpeechFailure {
  return { ok: false, error: code };
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`createTranscriber: ${name} must be a positive number`);
}
