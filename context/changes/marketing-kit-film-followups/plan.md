# Plan: marketing-kit-film-followups

Input: change.md, research.md. Complexity: medium (three phases, one per gap; they share the config schema).

## Goal

A committed `marketing.json` and voiceover cache reproduce a paid film with no hand work: the opening transition
is chosen in the config (`rewind`, `fade`, `cut`) and none flickers; recordings live in a folder per video while a
0.1.x flat cache is still found; `videos[].today` pins the recording day. `@softure-ai/marketing-kit` 0.1.6.

**Out of scope:** a `prune` command; moving an app's existing flat files (the app does it in git when it wants);
FIRE_TRACKER's adoption.

## Key decisions

| Decision | Choice | Source |
| --- | --- | --- |
| Transition setting | `hook.transition`: `fade` (default), `rewind`, `cut` | research §1 |
| Rewind without flicker | 5 key frames from the opening frame back to the scene start, joined by 0.2 s cross-fades, 0.8 s total | research §1 |
| Transition length | 0.8 s for `fade`/`rewind`, 0 for `cut`; taken from the film in `filmTimes` | research §Risks |
| Cache layout | `<cacheDir>/<video-id>/<key>.{mp3,json}`; lookup falls back to `<cacheDir>/<key>.*`; the key is unchanged | research §2 |
| Stale recordings | `voice` lists other keys in the video's folder; no prune | research §2 |
| Recording day | `videos[].today`, `--today` overrides | research §3 |
| Public API | `getVoiceoverPaths(cacheDir, input, videoId?)` and `ProduceVoiceoverOptions.videoId?`: optional, so 0.1.5 callers keep the flat layout; `rewindFrames` stays exported | plan |
| Version | 0.1.6 (patch, as every earlier release) | plan |

## Phase 1: The opening transition

**Discipline:** TDD for the frame choice and the ffmpeg arguments; test-after for the composition.
**Files:** `src/config/schema.ts`, `src/config/config.ts`, `src/film.ts`, `src/compose/timeline.ts`,
`src/compose/compose.ts`, `src/render/render.ts`, `src/index.ts`, tests and snapshots.

1. Schema: `hook.transition` enum with a default `fade` and a `.describe()`; `Film.hook.transition` typed.
2. `timeline.ts`: `TRANSITIONS`, `getTransitionSeconds(kind)` and `transitionFrames(kind, first, still)` (fade:
   `[still, first]`; rewind: `rewindFrames(first, still, 5)`; cut: `[]`); `crossfadeArgs({ inputs, fps, seconds,
   output })`: the ffmpeg arguments of a chain of `xfade=transition=fade` over looped stills, so the clip lasts
   exactly `seconds`.
3. `compose.ts`: `filmTimes` takes the transition length from the film; the transition `<video>` is written only
   when it lasts more than 0. Asset name `transition`.
4. `render.ts`: builds `assets/transition.mp4` with `crossfadeArgs`; no clip for `cut`; no `tmix`.
5. Tests: frames per kind (equal first and still, boundary); the args' offsets for 2 and 5 inputs; times with
   `cut` start the scene at the end of the opening; a real ffmpeg run produces a 0.8 s clip (skipped without
   ffmpeg); snapshots updated.

## Phase 2: The voiceover cache by video

**Discipline:** TDD.
**Files:** `src/voice/cache.ts`, `src/voice/produce.ts`, `src/cli/voice.ts`, tests, README.

1. `getVoiceoverPaths(cacheDir, input, videoId?)`: with a video id, the video's folder, unless only the flat pair
   exists (then the flat pair, `layout: "flat"`). Writes always go to the returned paths when nothing exists.
2. `findStaleVoiceovers(cacheDir, videoId, key)`: other `<key>.mp3` files in the video's folder.
3. `produceVoiceover` takes `videoId`; logs the cache hit with the path, a hint when the hit is flat
   (`git mv` it into the video's folder), and the stale files.
4. Tests: a flat 0.1.x pair (key computed from known input) is found with no provider call; a pair in the video's
   folder wins over a flat one; a miss with `--commit` writes into the folder; stale keys are listed, the live key is
   not; no `videoId` keeps the flat layout.

## Phase 3: The recording day in the config

**Discipline:** TDD for the schema and the precedence.
**Files:** `src/config/schema.ts`, `src/config/config.ts`, `src/film.ts`, `src/cli/main.ts`,
`src/record/record.ts` (message), tests, README, example config, `schema/marketing.schema.json`.

1. `videos[].today`: `YYYY-MM-DD`, a real day; `VideoConfig.today: string | null`.
2. `main.ts`: `options.today ?? film.today`; the recording line names the day and where it came from.
3. Screen guard message: names `videos[].today` as the way to pin the day of a committed voiceover.
4. Tests: valid day, malformed and impossible day refused; precedence helper.
5. README (all three), example config (`today`, `transition`), regenerate the JSON Schema, bump to 0.1.6
   (`package.json`, `package-lock.json`).

Done when (every phase): Gates green (typecheck, lint, test); `npm run build`.

## Progress

- [ ] Phase 1: the opening transition
- [ ] Phase 2: the voiceover cache by video
- [ ] Phase 3: the recording day in the config
