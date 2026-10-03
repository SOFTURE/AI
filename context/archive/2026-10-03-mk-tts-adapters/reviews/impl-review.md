# Implementation review: mk-tts-adapters

Reviewed: 5d7c1e5..HEAD on `claude/project-thread-h3430z` against plan.md @ 2026-10-03.
Mode: standard. Verdict: ready after fixes.
Findings: 0 critical, 0 warning, 3 suggestion (2 fixed in this review, 1 accepted).

## Plan conformance

| Plan item | Result |
| --- | --- |
| `TtsProvider` with `estimate` and `synthesize`, result values | done (`src/voice/provider.ts`) |
| ElevenLabs adapter, injectable `fetch`, key from `ELEVENLABS_API_KEY` | done (`src/voice/elevenlabs.ts`); a missing key fails `synthesize` only |
| Fake provider, exported | done (`src/voice/fake.ts`, `src/index.ts`) |
| Estimate in every dry run and before every paid call | done; `produce.test.ts` asserts the estimate line precedes the `synthesize` call; the fixture dry run printed `104 characters, at most 104 ElevenLabs credits` with no key set |
| Cache key and file format unchanged | done; `voiceover.test.ts` pin untouched; `produce.test.ts` reads a cache entry named `619a27159288f1e1` without a call and checks the written JSON byte for byte |
| Key never in errors (plan review W2) | done; every adapter error case asserts it |
| FIRE migration documented | done (README "Migrating FIRE_TRACKER's voiceover cache") |
| No schema change | confirmed: `src/config/` and `schema/` untouched |
| Ownership | only `src/voice/`, `src/cli/voice.ts`, `src/index.ts`, README, docs/03 |

## Gates

typecheck, lint (ESLint zero warnings + language gate), test (195 passed, 1 opt-in render test skipped),
build: green locally. No test reaches the network: the adapter is only called with injected `fetch`
stubs, and the CLI's real `fetch` is not exercised by any test.

## Findings

### S1 [SUGGESTION] Provider ids were declared twice
**Where:** `src/voice/providers.ts`. `TtsProviderId` repeated the schema's enum and could drift.
**Decision:** Fixed in this review: the type is `MarketingConfig["voice"]["provider"]`, so a new enum
value fails typecheck until the switch handles it.

### S2 [SUGGESTION] The result helpers were public API
**Where:** `src/index.ts`. `ok`/`err` were exported as `ttsOk`/`ttsError` with no consumer.
**Decision:** Fixed in this review: only the types are exported.

### S3 [SUGGESTION] Characters are counted as UTF-16 units
**Where:** `src/voice/elevenlabs.ts` `estimate`. An emoji counts as two, which can only over-estimate.
**Decision:** Accept risk - the estimate is an upper bound by design; accepted (auto).

## Follow-ups

None for the followups roadmap: nothing found outside this item's scope.
