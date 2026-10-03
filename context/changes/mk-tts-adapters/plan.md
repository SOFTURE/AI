# Plan: mk-tts-adapters

Input: change.md, research.md. Complexity: small (2 phases, one module and its CLI wiring).

## Goal

- `TtsProvider` (`src/voice/provider.ts`): `estimate(input)` returns the billed characters and an
  upper bound in the provider's unit; `synthesize(input)` returns a result with the audio and word
  timings. Input: `{ text, voiceId, model, language }`.
- `createElevenLabsProvider({ apiKey, fetch })` wraps today's request and parser; a missing key, a
  failed connection, a non-2xx answer and a malformed body are error results naming the operation.
- `createFakeTtsProvider()` returns deterministic audio and evenly spaced words and records its calls;
  exported for projects' own tests.
- `produceVoiceover({ cacheDir, input, provider, isCommit, log })` in `src/voice/` returns
  `cached | dry-run | recorded` or an error; it prints the estimate before any `synthesize` call and in
  every dry run, and calls `synthesize` only with `isCommit`.
- The cache key is unchanged (FIRE's `pl` key pinned); README documents the FIRE cache migration.

**Out of scope:** a second real provider (research unknown 2); schema changes (`voice.provider` stays
`elevenlabs`); per-plan prices in money; anything in `src/record/`, `src/compose/`, `src/render/`.

## Approach

**Chosen:** option A from research. Provider objects with result values; a pure orchestration in
`src/voice/` that owns the cache read/write; the CLI resolves the provider from `config.voice.provider`
and the environment and turns error results into `fail`.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Result shape | `{ ok: true, value } \| { ok: false, error: string }` local to the kit | the kit already returns `{ ok, … }` results (`config.ts:90`); no dependency on core for one type | research |
| Estimate | `{ characters, maxCredits, unit: "ElevenLabs credits" }`; `maxCredits = characters` | ElevenLabs bills per input character, at most 1 credit each; API plans discount it | research |
| Key check | missing `ELEVENLABS_API_KEY` is an error of `synthesize`, not of creating the provider | a dry run needs the estimate without a key | research |
| Words in the provider | the adapter returns `TimedWord[]` (alignment folded by `wordsFromAlignment`) | the interface promises word timings, not character alignment | roadmap |
| Cache files | `<key>.mp3` + `<key>.json` (`JSON.stringify(words, null, 1)` + newline), unchanged | FIRE byte compatibility | research |
| Cache module | `src/voice/cache.ts`: `getVoiceoverPaths(cacheDir, input)`, `readCachedVoiceover(paths)` (result: voiceover, null, or error for a broken JSON) | moves the cache out of the CLI so the orchestration is testable | plan |
| Logging | `produceVoiceover` takes `log: (line) => void` | testable order (estimate before synthesize) | plan |
| Provider in the key | not added | keeps FIRE's key; a second provider must add itself (documented) | research |
| Provider registry | `createTtsProvider(id, env)` in `src/voice/providers.ts`, one `elevenlabs` case | the CLI stays a mapper; schema enum is the source of ids | plan |

**Critical details:** the pinned key `619a27159288f1e1` must stay; the dry run must never call
`synthesize`; the estimate line must be logged before `synthesize` is called.

## Phase 1: Provider interface, adapters and orchestration

**Discipline:** TDD. **Files:** `src/voice/{provider,elevenlabs,fake,cache,produce,providers}.ts`,
`src/voice/voiceover.ts` (request/parser stay, re-used by the adapter), tests next to them.

1. `provider.ts`: `TtsInput`, `TtsRecording { audio: Buffer; words: TimedWord[] }`, `TtsEstimate`,
   `TtsResult<T>`, `TtsProvider { id; estimate; synthesize }`.
2. `elevenlabs.ts`: `createElevenLabsProvider({ apiKey, fetch = globalThis.fetch })`.
3. `fake.ts`: `createFakeTtsProvider({ wordSeconds = 0.4 })` with `calls`.
4. `cache.ts` and `produce.ts` as decided.
5. `providers.ts`: `createTtsProvider(id, env)`.

**Tests:** elevenlabs: request URL, headers and body through a fake `fetch`; a success yields audio
and words; no key → error and no `fetch`; network error, 401 with body, non-JSON, no alignment → errors;
estimate counts characters; the key appears in no error message. fake: words evenly spaced, one per whitespace token, deterministic.
produce: cached → no synthesize, "from the cache"; dry run → estimate printed, no synthesize, nothing
written; commit → estimate logged before the call, files written in FIRE's format, a second run is
cached; provider error → error and nothing written; a broken cached JSON → error naming the file; a
cache file under FIRE's pinned key is found for `pl`.

**Done when:**
- Automated: the tests above pass; gates green (typecheck, lint, test).

## Phase 2: CLI wiring, exports and docs

**Discipline:** test-after. **Files:** `src/cli/voice.ts`, `src/cli/main.ts` (only if a signature
changes), `src/index.ts`, `README.md`, `docs/03-marketing-kit.md` (voice line only).

1. `cli/voice.ts`: thin; builds the input from the film, the provider from config and env, maps
   results to `fail`; `requireVoiceover` and `getVoiceoverPaths` keep their signatures for `main.ts`.
2. `index.ts`: export the provider types, both factories, `produceVoiceover`, the cache helpers.
3. README: "Voiceover providers and cost", "Migrating FIRE's voiceover cache".

**Done when:**
- Automated: gates green (typecheck, lint, test, build); `softure-marketing voice <fixture video>`
  without `--commit` on the fixture prints the estimate and spends nothing (run by hand, no key set).

## Risks and rollback

- Key drift → the pinned test stays untouched.
- A paid call in a test → the adapter only uses the injected `fetch`; tests never pass the real one.
- Merge collisions with MK-3/MK-6 in `main.ts`/`index.ts` → small edits; master wins, re-apply.
- Rollback: revert the two commits; the CLI goes back to the inline call.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Provider interface, adapters and orchestration

#### Automated
- [x] 1.1 Adapter, fake, cache and orchestration tests pass — 5d7c1e5
- [x] 1.2 Gates green (typecheck, lint, test) — 5d7c1e5

### Phase 2: CLI wiring, exports and docs

#### Automated
- [x] 2.1 Gates green (typecheck, lint, test, build) — 5560c94

#### Manual
- [x] 2.2 The fixture's dry run prints the estimate and spends nothing — 5560c94
