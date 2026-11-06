---
change_id: marketing-kit-draft-loudness-1143
---

# Research: the draft's sound against the render's (issue #1143)

## 1. What the render does (`pipeline.ts`, `runRenderFootage`)

1. `buildSpeechArgs` cuts the speech to `rawSpeechFile` (`getSpeechChainFiles(assetsDir, stages)`).
2. `declickSpeech` (when `speech.declick` is not `off`) to `declickedFile`.
3. `normalizeLoudness(declickedFile, speechFile, film.loudness ?? DEFAULT_LOUDNESS)` unless `loudness: null`.
4. `buildMusicArgs` ducks the music to `assets/music.mp3`.
5. `buildFilmMixArgs` (speech, music, sfx) to `mix.wav`, then `mixFootage(mixLoudness, ...)` to `mix.m4a`
   (gain solved on uncompressed probes, limiter at the ceiling, at most `attempts` encodes, a last encode inside
   `warnTolerance` passes); a miss fails. Skipped with `mixLoudness: null`; a silent mix returns null.
6. `finishFootage` muxes `mix.m4a`, measures the finished file and returns `loudness` (`warning` on a near miss) and
   `mix` (what the stage did).

## 2. What the draft does (`draft.ts`, `runRenderFootageDraft`)

Steps 1, 2 and 4 only, with its own file names (`speech.mp3`, `speech.declicked.wav`), then one ffmpeg run that
`amix`es speech and music and encodes AAC 128k. No step 3, no step 5: the draft's level is the cut speech's level.
On the issue's material that is -32.3 LUFS against the render's -14.6.

## 3. What the draft can reuse

Every function of steps 3 and 5 is exported and audio only (no frames, no browser, no provider): `getSpeechChainFiles`,
`normalizeLoudness`, `buildFilmMixArgs`, `mixFootage`, `measureLoudness`, `getLoudnessVerdict`. The mix stage's AAC
(`mix.m4a`) can be stream-copied into the draft (`-c:a copy`), so the measured mix is the draft's sound with no
second lossy encode that could move its loudness or true peak.

The draft has no sound effects and no end card: the mix has speech and music only, and is the cut's length. The mix
stage brings whatever it gets to the same target, so the integrated loudness still matches the render (the sfx are
short and under the speech).

## 4. Overlap with #1139

#1139 makes the chain's files lossless and adds a pre-gain. With the draft on `getSpeechChainFiles` and the render's
stage functions, its edits to those helpers reach the draft; `draft.ts` stays this change's file only (told the
#1139 thread).
