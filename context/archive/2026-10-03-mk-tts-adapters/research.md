# Research: mk-tts-adapters

Input: change.md, roadmap MK-7, research.sources (`docs/03-marketing-kit.md`; FIRE_TRACKER is not
checked out in this session, so FIRE facts come from the MK-1 port and its archive). Depth: light (no
data, the code is a few hundred lines already ported and tested; the money risk is guarded by
`--commit`). Snapshot: e15e5c5 (master after PR #35), 2026-10-03.

## Summary

- The voiceover is one module (`tools/marketing-kit/src/voice/voiceover.ts`) of pure functions and one
  CLI file (`src/cli/voice.ts:69-109`) that reads `ELEVENLABS_API_KEY`, calls `fetch`, parses the
  response and writes `<key>.mp3` + `<key>.json` into `voice.cacheDir`. There is no seam for another
  provider and no test of the paid path, because it calls the network directly.
- The cache key already covers text, voice, model and language (`voiceover.ts:50-55`, done in MK-2),
  hashed in FIRE's exact shape `{text, voice, model, lang}`. A test pins FIRE's key for `pl`
  (`voiceover.test.ts:25-29`).
- The dry run prints only a character count (`cli/voice.ts:84-90`); the `--commit` path prints nothing
  before it spends.
- ElevenLabs bills text to speech per character of input: 1 credit per character in the UI, API usage is
  discounted per plan (ElevenLabs help centre, "What models do you offer"). An exact price depends on
  the account's plan, so an honest estimate is the character count and its upper bound in credits.

## Current state

- **Key** (`voiceover.ts:50-55`): `sha256(JSON.stringify({ text, voice, model, lang }))`, first 16 hex.
- **Request** (`voiceover.ts:57-68`): `POST /v1/text-to-speech/<voice>/with-timestamps?output_format=mp3_44100_128`,
  body `{ text, model_id, language_code, voice_settings }`, header `xi-api-key`.
- **Response** (`voiceover.ts:79-104`): `audio_base64` and `alignment.{characters, character_start_times_seconds,
  character_end_times_seconds}`; `readTimestampsResponse` throws on a wrong shape.
- **Words** (`voiceover.ts:111-140`): characters joined into words at whitespace, times rounded to ms.
- **Cache** (`cli/voice.ts:21-62`): `getVoiceoverPaths`, `findCachedVoiceover` (checks the words JSON
  shape), `requireVoiceover` (used by `record` and `render`, `cli/main.ts:43,101`).
- **Callers:** `voice` calls `produceVoiceover(config, film, isCommit)`; `all` calls it with `false`
  and fails when it returns null (`cli/main.ts:147-171`).
- **Config:** `voice.provider` is `z.enum(["elevenlabs"])` (`config/schema.ts:164`), carried to
  `config.voice.provider` (`config/config.ts:189`).

## Unknowns from the roadmap

1. **Can FIRE's cache be re-keyed without paid calls?** No re-keying is needed. FIRE's key hashed the
   same object with `lang: "pl"` fixed (MK-1 research, `cli.ts:158-206`); the ported key hashes the
   same object with `lang` from `voice.language`. With `voice.language: "pl"`, FIRE's voice id and
   model, every FIRE file keeps its name. The migration is: copy FIRE's voiceover folder into
   `voice.cacheDir`, set `language: "pl"`, and run `softure-marketing voice <video>` without `--commit`;
   it reports "from the cache" for each video and spends nothing. The words JSON is written in FIRE's
   format (`JSON.stringify(words, null, 1)`), so the files are byte-identical.
2. **A second provider worth stubbing?** None now. A real second provider needs word timings in the
   same call (ElevenLabs `with-timestamps`); others return them only through SSML marks or streaming
   events (inferred, not verified here), which is real adapter work, not a stub. The fake provider
   covers the interface in tests. When a second real provider lands, it must add itself to the key
   (inferred risk: two providers with the same voice id and model string; unlikely, documented).

## Constraints and risks

- The pinned key must not change; the provider id stays out of the hash for ElevenLabs.
- Tests must not reach the network: the adapter takes an injectable `fetch`.
- `src/cli/voice.ts` is shared CLI wiring; MK-3 (`src/record/`) and MK-6 (`src/compose/`, `src/render/`)
  do not touch it, so the overlap is limited to `src/cli/main.ts` (one call site) and `src/index.ts`
  (exports), both easy merges.

## Options

- **A. Provider objects + a pure orchestration in `src/voice/` (chosen).** `TtsProvider` with
  `estimate(input)` and `synthesize(input)` returning a result; `produceVoiceover` in `src/voice/`
  decides cache / dry run / commit and takes the provider and a logger, so it is unit-testable with the
  fake provider and a temp dir. The CLI only maps results to `fail`.
- **B. Keep the CLI flow, only extract the `fetch` call.** Smaller, but the commit path stays untested
  and the cost print stays in the CLI.

## Testing

Vitest, `NODE_ENV=test`. Existing: `src/voice/voiceover.test.ts` (key, text, request, response, words,
beats). New tests can write into `mkdtempSync(tmpdir())` and use a fake `fetch`.
