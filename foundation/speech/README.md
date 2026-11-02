# @softure-ai/speech

One way for an app to turn audio into text: a voice note, the sound of a short video, a clip that needs subtitles.
The package gives it

- `createTranscriber`: any audio or video file (or bytes) in, a transcript with timed segments out, as a `Result`
  whose failures are stable codes;
- adapters for Groq (`whisper-large-v3-turbo`), OpenAI (`whisper-1`, `gpt-4o-transcribe`) and any OpenAI-compatible
  endpoint (a self-hosted faster-whisper server);
- input normalization through ffmpeg: mono 16 kHz audio, long inputs cut into overlapping chunks under the provider's
  upload limit and stitched back with corrected timestamps;
- `toSrt`, `toVtt` and `toParagraphs` for the segments;
- a usage record per call (provider, model, seconds, cost in USD, purpose), ready for a spend ledger;
- `fakeTranscriber()` for tests, answering from a script.

It is shaped like [`@softure-ai/llm`](../llm/README.md): no tables, no routes, no `softure.config.ts` entry. The
provider, its key and the prices stay in the app.

## Installation

```bash
npm install @softure-ai/speech zod
```

`zod` (4) is a peer dependency. The process that transcribes needs **ffmpeg**: on `PATH`, at `FFMPEG_PATH`, or at the
`ffmpegPath` option. Transcription is slow and belongs in a job worker
([`@softure-ai/jobs`](../../modules/jobs/README.md)), so ffmpeg goes into the worker's image, not the app's:
`softure-deploy init --worker-dockerfile=docker/worker.Dockerfile` gives the worker an image of its own
([`@softure-ai/deploy`](../../tools/deploy/README.md)); a Debian base installs it with
`apt-get install -y --no-install-recommends ffmpeg`.

## Usage

```ts
// lib/speech.ts (server only)
import { createTranscriber, groqProvider } from "@softure-ai/speech";

export const transcriber = createTranscriber({
  provider: groqProvider(), // GROQ_API_KEY, whisper-large-v3-turbo
  pricing: { "whisper-large-v3-turbo": { usdPerMinute: 0.04 / 60 } },
  onUsage: (record) => recordSpend(record), // the app's own ledger
});
```

```ts
import { toSrt } from "@softure-ai/speech";
import { transcriber } from "@/lib/speech";

const result = await transcriber.transcribe({
  input: { kind: "file", path: upload.path }, // or { kind: "bytes", bytes, fileName: "note.ogg" }
  language: "en", // optional: without it the provider detects the language
  prompt: "Ingredients: gochujang, mirin", // optional vocabulary hints
  purpose: "recipe-import",
  attributes: { accountId: account.id },
});
if (!result.ok) return result; // see "Failure codes"
const { text, segments, language, durationSeconds, costUsd } = result.value;
const subtitles = toSrt(segments);
```

In a job handler, a rate limit becomes a retry at the time the provider named:

```ts
"media.transcribe": defineJobHandler({
  payload: z.object({ fileId: z.string() }),
  run: async ({ fileId }, { db }) => {
    const file = await findFile(db, fileId);
    const result = await transcriber.transcribe({ input: { kind: "file", path: file.path }, purpose: "clip-subtitles" });
    if (!result.ok && result.error === "speech.rate_limited") return retryJobLater(result.error, result.retryAfterSeconds ?? 60);
    if (!result.ok && (result.error === "speech.too_long" || result.error === "speech.unsupported_format")) return failJob(result.error);
    if (!result.ok) return result; // retried with the queue's backoff
    await saveTranscript(db, fileId, result.value);
    return ok();
  },
}),
```

### `createTranscriber(options)`

| Option | Default | Meaning |
| --- | --- | --- |
| `provider` | required | `groqProvider()`, `openAiProvider()`, `openAiCompatibleProvider({ … })`, or the app's own `SpeechProvider` |
| `normalizer` | `createFfmpegNormalizer()` | turns the input into chunks; replace it only for another tool than ffmpeg |
| `pricing` | `{}` | model id → `{ usdPerMinute }`; a model without an entry has `costUsd: null` |
| `onUsage` | none | `(record: SpeechUsageRecord) => void \| Promise<void>`, awaited once after every call that sent audio, failures included; a throw propagates |
| `timeoutMs` | `120000` | time limit of one provider request (one chunk) |
| `maxDurationSeconds` | `10800` (3 h) | longer input is `speech.too_long` before anything is uploaded; ffmpeg stops decoding just past it |
| `chunkSeconds` | `600` | length of a chunk; 600 s of 16 kHz mono FLAC stays under 20 MB |
| `overlapSeconds` | `3` | what neighbouring chunks share; less than half of `chunkSeconds` |
| `clock` | `systemClock` | measures `durationMs` and `at` of usage records |

Invalid options throw a `RangeError` naming the option. A request needs a non-empty `purpose`.

### `transcribe(request)` → `Result<Transcript>`

| Field | Meaning |
| --- | --- |
| `text` | the segments' texts joined with single spaces |
| `segments` | `{ start, end, text }[]` in seconds from the start of the input, chunk overlaps resolved |
| `language` | what the provider detected (`"english"`), else the requested `language`, else `null` |
| `durationSeconds` | length of the normalized audio |
| `provider`, `model` | from the provider adapter |
| `billedSeconds` | seconds of audio sent, overlaps included: what the provider bills |
| `costUsd` | `billedSeconds` at the model's `pricing`, or `null` |

How a long input is cut: ffmpeg decodes the input once to raw mono 16 kHz samples (which gives the exact length), and
each chunk is cut from those samples and encoded as FLAC only when it is sent, so memory holds one chunk at a time. The
temporary files live in a private folder that is removed on every path, a thrown error included. In the overlap of two
chunks the cut is the overlap's middle: a segment belongs to the chunk in which its middle falls before the cut, so a
word split by a chunk's edge is taken from the chunk that heard it whole. A model without segments (the gpt-4o
transcription models) gives one segment per chunk.

### Failure codes

| Code | When | Retry? |
| --- | --- | --- |
| `speech.too_long` | longer than `maxDurationSeconds`, a chunk over the provider's `maxUploadBytes`, or HTTP 413 | no |
| `speech.unsupported_format` | ffmpeg could not decode any audio from the input, or the provider answered 400 or 415 | no |
| `speech.provider_refused` | HTTP 401, 403 or another 4xx (a wrong key, a model the provider does not serve) | no, fix the setup |
| `speech.rate_limited` | HTTP 429; `retryAfterSeconds` holds the provider's `Retry-After` or `null` | after `retryAfterSeconds` |
| `speech.timeout` | a provider request ran past `timeoutMs` | yes |
| `speech.unavailable` | network failure, HTTP 5xx, an answer that could not be read, or a missing API key | yes |

A missing ffmpeg binary is a broken installation, not an input problem: `transcribe` throws an error naming the path.

### Providers

| Adapter | Default model | Key | Endpoint |
| --- | --- | --- | --- |
| `groqProvider({ apiKey?, model?, maxUploadBytes?, fetch? })` | `whisper-large-v3-turbo` | `GROQ_API_KEY` | `https://api.groq.com/openai/v1` |
| `openAiProvider({ apiKey?, model?, maxUploadBytes?, fetch? })` | `whisper-1` | `OPENAI_API_KEY` | `https://api.openai.com/v1` |
| `openAiCompatibleProvider({ name, baseUrl, model, apiKey?, maxUploadBytes?, fetch? })` | required | optional (`string` or a function) | `baseUrl` |

- A key not passed is read from the environment on every call; a missing one is `speech.unavailable`, and nothing is
  sent.
- All three post the chunk to `{baseUrl}/audio/transcriptions` with `response_format=verbose_json` and segment
  timestamps (`json` for the `gpt-4o*-transcribe` models, which return no segments).
- `maxUploadBytes` defaults to 25 MB, the limit of Groq's free tier and of OpenAI. Lower `chunkSeconds` with it when a
  self-hosted server accepts less.
- Requests follow no redirects and never put the key into an error (`requestJson` from `@softure-ai/core`).

Prices as published on 2026-11-02, for the app's `pricing` (check the provider before relying on them):

```ts
const pricing = {
  "whisper-large-v3-turbo": { usdPerMinute: 0.04 / 60 }, // Groq
  "whisper-large-v3": { usdPerMinute: 0.111 / 60 }, // Groq
  "whisper-1": { usdPerMinute: 0.006 }, // OpenAI
  "gpt-4o-transcribe": { usdPerMinute: 0.006 }, // OpenAI
  "gpt-4o-mini-transcribe": { usdPerMinute: 0.003 }, // OpenAI
};
```

### Output helpers

- `toSrt(segments)`: SubRip cues numbered from 1, `00:01:02,500 --> 00:01:04,000`.
- `toVtt(segments)`: `WEBVTT`, then cues with `00:01:02.500 --> 00:01:04.000`.
- `toParagraphs(segments, { gapSeconds?, maxChars? })`: plain text, a blank line at pauses of `gapSeconds` (1.5) or
  more, and after the sentence that takes a paragraph past `maxChars` (600).

All three trim each segment's text to one line and skip empty segments.

### Usage records and a spend ledger

`onUsage` gets one `SpeechUsageRecord` per call that sent audio: `{ provider, model, seconds, costUsd, outcome,
purpose, durationMs, at, attributes }`. `outcome` is `"ok"` or the failure code; a call that failed on its third chunk
reports the seconds of the two chunks the provider transcribed, since those are billed. A call that sent nothing
(too long, not media, the first request failed) reports nothing.

## Testing

```ts
import { fakeTranscriber } from "@softure-ai/speech/testing";

const transcriber = fakeTranscriber(
  { kind: "transcript", segments: [{ start: 0, end: 3, text: "Two eggs." }], language: "english" },
  { kind: "failure", code: "speech.rate_limited", retryAfterSeconds: 30 },
);
await importRecipe({ transcriber }); // first call: the transcript; second and later: the rate limit
expect(transcriber.calls[0]?.purpose).toBe("recipe-import");
```

A `transcript` answer without `segments` gets one segment of `durationSeconds` (2) with `text` ("Fake transcript.");
the last answer repeats, and without answers every call gets the default transcript. For code that builds its own
transcriber, `createTranscriber` takes a `normalizer` and a provider with a `fetch`, so a test needs neither ffmpeg nor
the network.
