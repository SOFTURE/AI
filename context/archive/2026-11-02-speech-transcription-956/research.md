# Research: speech-transcription-956

## What exists

- `@softure-ai/llm` (`foundation/llm`): the shape to copy. `createLlm(options)` returns calls that resolve to
  `Result<…, LlmErrorCode>`; options validated with a `RangeError` naming the option; `onUsage` hook with a record
  (model, provider, usage, `costUsd`, outcome, duration, `at`, attributes); a `/testing` entry with a scripted fake.
  Foundation packages need no `module.json` (tests/repo/packages.test.ts runs module rules only under `modules/`).
- `@softure-ai/core` `requestJson`: a JSON call with a `FormData` body (multipart), timeout, no redirects, failures as
  codes (`core.http_refused` with status, `core.http_rate_limited` with `retryAfterSeconds`, `core.http_unavailable`,
  `core.http_unreachable`, `core.http_unexpected_answer`) and zod narrowing. It covers the provider call entirely.
- `@softure-ai/mailing` providers read their key from `process.env` on every send when not passed (`RESEND_API_KEY`).
- No package takes a `ctx` first argument; the call context (attributes, purpose) travels on the request, as in llm.
- #948 (master 5bf47dc): `softure-deploy init --worker-dockerfile` gives the worker an image of its own; the README of
  `@softure-ai/deploy` points at a Debian base with ffmpeg.

## Providers

All three speak OpenAI's `POST {base}/audio/transcriptions` multipart API: `file`, `model`, `language`, `prompt`,
`response_format`, `timestamp_granularities[]`.

- Groq: base `https://api.groq.com/openai/v1`, `whisper-large-v3-turbo` (USD 0.04 per hour), `whisper-large-v3`
  (0.111 per hour); `verbose_json` returns `language`, `duration`, `segments[{start,end,text}]`; 25 MB upload limit
  on the free tier.
- OpenAI: base `https://api.openai.com/v1`, `whisper-1` (USD 0.006 per minute) supports `verbose_json`;
  `gpt-4o-transcribe` / `gpt-4o-mini-transcribe` answer only `json` (`text`, no segments, no duration). 25 MB limit.
- OpenAI-compatible (a self-hosted faster-whisper server, e.g. speaches): same endpoint, own base URL, key optional.
- Errors: 413 (file too large), 415/400 for a file it cannot decode, 401/403 for a key, 429 with `Retry-After`, 5xx.

## ffmpeg

- Decoding any audio or video to raw PCM `s16le`, mono, 16 kHz gives an exact duration (bytes / 32 000) without
  ffprobe and without parsing stderr. A non-zero exit means the input is not decodable media.
- Each chunk is then cut from the PCM file and encoded as FLAC (lossless, accepted by all three): 16 kHz mono is at
  most 32 kB/s, so a 600 s chunk stays under 20 MB even uncompressed, under the 25 MB limit.
- ffmpeg is present in this container (`/usr/bin/ffmpeg`), not in the CI `test` job (only the render job installs it),
  so the real-ffmpeg test is `skipIf` without it; the rest runs against an injected command runner.

## Stitching chunks

Chunks of `chunkSeconds` overlapping by `overlapSeconds`. Segments come back relative to their chunk and are shifted
by the chunk's start. In the overlap of chunks k and k+1 the cut is the overlap's middle: chunk k keeps segments whose
middle is before it, chunk k+1 those whose middle is at or after it. A word split at a chunk edge is thus taken from
the chunk that heard it whole.
