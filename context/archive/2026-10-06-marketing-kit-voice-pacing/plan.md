# Plan: marketing-kit-voice-pacing

Input: change.md, research.md. Complexity: medium (three phases; they share the CLI and the config schema).

## Goal

`softure-marketing voice <film> [<film>…] --commit` records a batch of paid voiceovers spaced by
`voice.minIntervalSeconds` (also across runs), stops at the first provider error, and reports the real charge
next to the estimate; `social.disclosure` adds one disclosure paragraph to every post. `@softure-ai/marketing-kit`
0.1.7.

**Out of scope:** retrying a failed call; reading the account balance; FIRE_TRACKER's adoption.

## Key decisions

| Decision | Choice | Source |
| --- | --- | --- |
| Pacing state | newest `*.json` mtime under `voice.cacheDir` | research |
| Interval | `voice.minIntervalSeconds`, 0-3600, default 60 | research |
| Batch | several films for `voice` only; sequential; stop at the first failure | research |
| Charge | `TtsRecording.charged: number \| null` from `character-cost` | research |
| Disclosure | `social.disclosure` with `{persona}`; `posts[].disclosure: false` opts out | research |
| Public API | `ProduceVoiceoverOptions.pace?` optional, so 0.1.6 callers keep working; `TtsRecording.charged` optional for third-party providers | plan |
| Version | 0.1.7 | plan |

## Phase 1: The real charge

**Discipline:** TDD.
**Files:** `src/voice/provider.ts`, `src/voice/elevenlabs.ts`, `src/voice/produce.ts`, `src/voice/fake.ts`, tests.

1. `TtsRecording.charged?: number | null`; ElevenLabs reads `character-cost` (a non-negative number, else null).
2. `produceVoiceover` returns `charged` on `recorded` and logs `charged X <unit> (estimate at most Y)` or that the
   provider did not report it.
3. Tests: header present, missing, malformed; the log lines.

## Phase 2: Pacing and the batch

**Discipline:** TDD for pacing and options; test-after for the CLI loop.
**Files:** `src/voice/pace.ts` (new), `src/voice/produce.ts`, `src/config/schema.ts`, `src/config/config.ts`,
`src/cli/options.ts`, `src/cli/voice.ts`, `src/cli/main.ts`, tests.

1. `findLastRecordingTime(cacheDir)`: newest `*.json` mtime in the cache and one level of video folders, or null.
2. `waitForPace({ cacheDir, minIntervalSeconds, now, sleep, log })`: sleeps the remainder, logs how long.
3. `produceVoiceover` takes `pace?` and waits right before `synthesize` (never on a cache hit or dry run).
4. Schema `voice.minIntervalSeconds` with `.describe()`; config passes it on.
5. Options: `voice` takes several films (`filmIds`), duplicates refused; other commands keep one.
6. CLI: films in order; a failure prints what was recorded, where it stopped and what was not attempted, exit 1;
   the end prints the totals (characters, estimate, charged); a dry run of several films prints the batch's
   characters and estimate too, so the cost is known before `--commit`.
7. `src/index.ts` exports `waitForPace` and `findLastRecordingTime` next to `produceVoiceover`.
8. Tests: wait computed from a file's mtime, no wait when old or interval 0, no wait on a cache hit; options.

## Phase 3: The disclosure

**Discipline:** TDD.
**Files:** `src/config/schema.ts`, `src/config/config.ts`, `src/posts/posts.ts`, tests, README, example config,
`schema/marketing.schema.json`, `package.json`, `package-lock.json`.

1. `social.disclosure` (non-blank string) and `posts[].disclosure` (boolean, default true), both described.
2. `VideoPost.disclosure: string | null` with `{persona}` replaced by the video's persona name.
3. `buildPosts`: caption, disclosure, link, hashtags.
4. Tests: with, without, opted out, `{persona}` replaced.
5. README (batch voice, pacing, charge, disclosure, upgrade note), example config, JSON Schema, bump to 0.1.7.

Done when (every phase): Gates green (typecheck, lint, test); `npm run build`.

## Progress

- [x] Phase 1: the real charge — 15b9207
- [x] Phase 2: pacing and the batch — 8430495
- [x] Phase 3: the disclosure
