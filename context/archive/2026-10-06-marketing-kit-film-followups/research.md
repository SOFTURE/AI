# Research: marketing-kit-film-followups

Input: change.md (MK-10). Sources: the package code on `master` (7fcfce1), FIRE's finding as quoted in change.md.
FIRE_TRACKER itself is not readable from cloud sessions; nothing here depends on reading it.

## Current state

### Opening transition
- `src/compose/compose.ts:24`: `REWIND = 0.8` is fixed; `filmTimes` adds it to every time after the opening
  (`offset = hook + REWIND - firstFrame / fps`) and the composition always places `<video id="rewind">` between
  the opening still and the recording.
- `src/render/render.ts` (`buildComposition`): `rewindFrames(firstBeat.f0, still)` picks 24 frames evenly between
  the opening frame and the scene's first frame, then ffmpeg encodes them at the recording's fps with
  `tmix=frames=3`. In FIRE the span was about 40 s of a wizard, so each of the 24 frames is a different screen,
  and the 3-frame blend ghosts three screens at once: the flicker the owner saw.
- `rewindFrames` (`src/compose/timeline.ts:325`) is exported from `src/index.ts`.
- FIRE's hand fix: a plain 0.8 s cross-fade (`xfade=transition=fade`) from the opening frame to the scene's first
  frame. That is what the owner accepted.

### Voiceover cache
- `src/voice/cache.ts`: `getVoiceoverPaths(cacheDir, input)` → `<cacheDir>/<key>.mp3|json`; `key` is
  `voiceoverKey(text, voice, model, language)` (16 hex chars, `src/voice/voiceover.ts:49`).
- Callers: `src/voice/produce.ts` (read, then write after a paid call), `src/cli/voice.ts` (`requireVoiceover`,
  the key stored in `log.json`), `src/index.ts` exports both functions.
- `log.json` stores `voiceoverKey`; `render` compares it with the current key. The key itself must not change, or
  every existing recording is lost.

### Recording day
- `src/cli/options.ts`: `--today=YYYY-MM-DD`, validated; `src/cli/main.ts` passes it to `recordFilm`.
- `src/record/record.ts:129`: without `today` the page clock starts at `new Date()`; with it at `<day>T12:00:00Z`.
- `marketing.json` has no field for it (`videoSchema`, `src/config/schema.ts`); `VideoConfig` is built in
  `resolveVideos` (`src/config/config.ts`). The screen-guard error says `--today` "only reproduces an old film".

## Options considered

1. **Transition.** (a) a `hook.transition` enum `rewind | fade | cut` with the rewind rebuilt; (b) drop the rewind.
   (a) keeps the feature the change asks to keep. A rewind that does not flicker: few key frames (5) joined by
   cross-fades (each dissolve 0.2 s), so no two unrelated screens alternate frame by frame. Fade: the same machinery
   with two frames. Cut: no clip, the scene starts right after the opening (0 s).
   Default: `fade`, because it is what FIRE's delivered film shows and what the owner approved; `rewind` stays
   available by choice.
2. **Cache layout.** (a) per-video folder `<cacheDir>/<video-id>/<key>.*`; (b) readable prefix
   `<video-id>-<key>.*` in one folder. (a) groups a film's recordings, so a stale one sits next to the live one and
   is listed by `voice`; the key stays the same, so `log.json` and old recordings keep matching. Lookup order: the
   video's folder, then the flat 0.1.x file. New recordings go to the video's folder. A `prune` command is left
   out: `voice` lists the stale files in the folder and the reader deletes them in git.
3. **Recording day.** `videos[].today` (`YYYY-MM-DD`, a real calendar day); `--today` overrides it. The name
   matches the flag, so the README explains one concept.

## SOFTURE modules
None applies (a package-internal change).

## Risks
- A missed lookup of a flat cache costs a paid call in every adopting app: a test with a real 0.1.x file name
  (key computed from known input) must find it.
- The transition length is part of every time after the opening; `cut` makes it 0, so `filmTimes` and the
  snapshots must take it from the film, not from a constant.
