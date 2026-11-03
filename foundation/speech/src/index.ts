export { SPEECH_ERROR_CODES } from "./contract.js";
export type {
  SpeechErrorCode,
  SpeechFailure,
  SpeechPrice,
  SpeechPricing,
  SpeechUsageHook,
  SpeechUsageRecord,
  Transcript,
  TranscriptSegment,
} from "./contract.js";
export { toParagraphs, toSrt, toVtt } from "./subtitles.js";
export type { ParagraphOptions } from "./subtitles.js";
export { groqProvider, openAiCompatibleProvider, openAiProvider } from "./providers.js";
export type {
  HostedProviderOptions,
  OpenAiCompatibleProviderOptions,
  ProviderChunk,
  ProviderTranscript,
  SpeechProvider,
} from "./providers.js";
export { createTranscriber } from "./create-transcriber.js";
export type { TranscribeRequest, Transcriber, TranscriberOptions } from "./create-transcriber.js";
export { createFfmpegNormalizer } from "./ffmpeg.js";
export type {
  AudioChunk,
  AudioFile,
  AudioInput,
  AudioNormalizer,
  CommandRunner,
  FfmpegNormalizerOptions,
  NormalizedAudio,
  NormalizeOptions,
} from "./ffmpeg.js";
