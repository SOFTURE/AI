# Plan: speech-transcription-956

Input: change.md, research.md. Complexity: medium (a new foundation package, no database, no UI).

## Goal

`foundation/speech` publishes `@softure-ai/speech` (starting at `0.0.0`, `## Unreleased`): `createTranscriber` over a
provider adapter and an ffmpeg normalizer, the output helpers, a usage hook and `/testing` `fakeTranscriber`.

## Approach

A foundation package shaped like `@softure-ai/llm` (no `module.json`: no tables, routes or copy). The provider call
reuses core's `requestJson` with a `FormData` body; the three adapters are one OpenAI-compatible client with different
defaults. Normalization decodes to raw PCM once (exact duration, capped at the length limit), then cuts FLAC chunks
lazily, so long inputs never sit in memory. Chunks overlap and are stitched at the overlap's middle.

Rejected: the AI SDK's `experimental_transcribe` (experimental, no segments for every provider, no chunking, another
peer dependency); a `ctx` first argument (no package has one; attributes and purpose ride on the request as in llm);
ffprobe for the duration (a second binary; the PCM size is exact).

## Phase 1: package, contract, output helpers and stitching (TDD)

Files: `foundation/speech/{package.json,tsconfig.json,tsconfig.build.json,CHANGELOG.md,README.md}`,
`src/contract.ts`, `src/subtitles.ts`, `src/stitch.ts`, `src/index.ts`, tests.

1. `SPEECH_ERROR_CODES`: `speech.too_long`, `speech.unsupported_format`, `speech.provider_refused`,
   `speech.rate_limited` (with `retryAfterSeconds`), `speech.timeout`, `speech.unavailable`; the `Transcript`,
   `TranscriptSegment`, `SpeechUsageRecord`, `SpeechPricing` types.
2. `toSrt(segments)`, `toVtt(segments)`, `toParagraphs(segments, { gapSeconds, maxChars })`.
3. `stitchChunks(chunks)`: shifts segments by chunk start and cuts overlaps at their middle.

Done when the helpers' tests pass (empty input, hour-long timestamps, rounding, overlap cut).

## Phase 2: provider adapters (TDD)

Files: `src/providers.ts`, tests with a fake `fetch`.

1. `openAiCompatibleProvider({ name, baseUrl, apiKey?, model, maxUploadBytes?, fetch? })`: posts the chunk with
   `verbose_json` and segment timestamps (`json` for the `gpt-4o*-transcribe` models, one segment for the whole chunk).
2. `groqProvider` (default `whisper-large-v3-turbo`, `GROQ_API_KEY`) and `openAiProvider` (default `whisper-1`,
   `OPENAI_API_KEY`); keys read on every call when not passed; a missing key is `speech.unavailable`.
3. Failure mapping: 413 → `too_long`, 400/415 → `unsupported_format`, other 4xx → `provider_refused`, 429 →
   `rate_limited`, a request aborted by its time limit → `timeout`, the rest → `unavailable`.

## Phase 3: normalizer, transcriber, usage and the fake (TDD)

Files: `src/ffmpeg.ts`, `src/create-transcriber.ts`, `src/testing/index.ts`, tests (one real-ffmpeg test, skipped
where ffmpeg is missing).

1. `createFfmpegNormalizer({ ffmpegPath, tempDir, run? })`: path or bytes → PCM mono 16 kHz (decode capped at the limit
   plus one second) → chunk plan → `read()` encodes each chunk to FLAC; `dispose()` removes the temp folder; a non-zero
   exit is `speech.unsupported_format`, a missing binary throws naming the path.
2. `createTranscriber({ provider, normalizer?, pricing?, onUsage?, timeoutMs?, maxDurationSeconds?, chunkSeconds?,
   overlapSeconds?, clock? })` with `transcribe({ input, language?, prompt?, purpose, attributes? })`: too long before
   any upload, chunks in order, stitched transcript, cost from `pricing` (USD per minute of audio sent), one `onUsage`
   record per call that sent audio, the temp folder removed on every path.
3. `/testing`: `fakeTranscriber(...responses)` with scripted transcripts and failures and the calls it received.

## Phase 4: docs

Package README (install, ffmpeg in the worker image with `--worker-dockerfile` from #948, the three providers and env
keys, chunking, subtitles, cost and a spend ledger, the fake), CHANGELOG `## Unreleased`, root README layout line.

## Risks and rollback

A new package nobody depends on yet: rollback is reverting the merge. Provider answers are narrowed with zod, so a
changed answer shape is `speech.unavailable`, never a crash. The ffmpeg path is covered by a real test locally and by
an injected runner in CI.

## Decisions (auto)

- Placement → `foundation/speech`, next to `llm` (no tables, routes or copy; the module rules do not apply).
- `ctx` argument → none; `purpose` (required) and `attributes` ride on the request and reach `onUsage`.
- Extra code `speech.unavailable` → added (network, 5xx, missing key, unreadable answer), like `llm.unavailable`.
- Prices → app-supplied `pricing` (USD per minute), no built-in table that would go stale; README shows current ones.
- Timeout → per provider request (default 120 s); retries left to the caller (a jobs retry with `retryAfterSeconds`).
- Version → `0.0.0` and `## Unreleased`; the coordinator publishes `0.1.0` in the combined release.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: package, contract, output helpers and stitching

#### Automated
- [x] 1.1 Helpers and stitching tested (empty, long timestamps, overlap cut) — 539cb10
- [x] 1.2 Gates green (typecheck, lint, test) — 539cb10

### Phase 2: provider adapters

#### Automated
- [x] 2.1 Request shape and every failure mapping tested with a fake fetch — 41fbb05
- [x] 2.2 Gates green (typecheck, lint, test) — 41fbb05

### Phase 3: normalizer, transcriber, usage and the fake

#### Automated
- [x] 3.1 Normalizer tested with a runner and with real ffmpeg; transcriber tested end to end with a fake provider — d17a2c0
- [x] 3.2 Gates green (typecheck, lint, test, build) — d17a2c0

### Phase 4: docs

#### Automated
- [ ] 4.1 README, CHANGELOG and root layout line; markdown link test green
