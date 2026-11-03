# Research: marketing-kit-keyterms-1012

## Confirmation (master 06123f0)

- `src/footage/providers.ts`: `SttInput` is `{ audio, language, signal? }`; no key terms.
- `src/footage/elevenlabs.ts` `createElevenLabsSttProvider`: form fields `model_id`, `file`, `language_code`,
  `timestamps_granularity`, `tag_audio_events`; never `keyterms`.
- `src/footage/film.ts` `FootageFilm`: no key terms field; `src/config/schema.ts` footage film schema: none either.
- `src/footage/paid.ts` `getTranscriptCache`: key from `{ clip, isolated, provider, model, language }`.
- `estimateFootageFilm`: `credits = units * rates[step]`; `FootageRates = Record<PaidStepKind, number>`.
- `src/footage/fake.ts`: the fake STT pushes every `SttInput` into `calls`, so a new field is recorded as is.

The issue's report is confirmed.

## Scribe facts (checked 2026-11-03)

- Keyterm prompting guide (elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/keyterm-prompting):
  Scribe v2 batch takes up to 1000 keyterms of at most 50 characters, each at most 5 words; "comes at an additional
  cost". Passed as the `keyterms` parameter (repeated form field in the multipart request).
- API pricing page (elevenlabs.io/pricing/api, FAQ): Speech to Text $0.22 per hour (Scribe), keyterm prompting
  $0.05 per hour on top. So about +23 % on the transcription rate.

## Options

1. Key terms on the film, normalized in one helper (`normalizeKeyTerms`) used by the config schema and the pipeline;
   cache key gains `keyTerms` only when non-empty; a surcharge rate `FootageRates.keyTerms` added to the transcribe
   rate. Chosen.
2. Key terms per clip: rejected; the names are the film's subject, the issue asks for the film, and per-clip lists
   multiply cache keys for no gain. An app can still differ per film.

## Decisions (auto)

- Deduplication is case-sensitive after trimming (`ElevenLabs` and `elevenlabs` are different spellings, and the
  spelling is the point); whitespace inside a term is collapsed to one space.
- Sorting uses code-point order (`a < b` comparison), not locale order, so the cache key is the same on every host.
- A film object with invalid key terms fails `transcribeFootage` and `estimateFootageFilm` with the problems listed,
  before anything is paid for; placeholder runs ignore them (no STT call).
