---
change_id: marketing-kit-isolate-speech-ranges-1087
status: done
---

# Research

Verified against master a5deade.

- Whole-clip isolation lives in `runTranscribeFootage` (`src/footage/pipeline.ts`): the clip's sound is extracted
  (`buildAudioArgs` from the normalized clip), sent to `providers.isolation.isolate`, written to
  `getIsolatedCache(film, clipKey)` (`footageCacheKey("isolated", { clip, provider })`), charged with `onCharge`
  step `isolate`, and `speech[id]` points at the cleaned file. Nothing isolates a part of a clip.
- The render takes `TranscribeOutcome.speech` (clip id → audio file as long as the trimmed clip) in
  `buildSpeechArgs`; each segment's sound comes from `getSoundSpan(segment)`, and `audio.ownVolume > 0` also reads
  the picture clip's own span. With `isCutAudioCrossfade` each side reads half the cut fade past its span.
- `getClipCacheKey(source, clip)` is the clip identity (bytes + trim) used by every paid cache.
- `estimateFootageFilm` (`paid.ts`) probes clips, finds cached steps and prices whole-clip isolation; it knows the cut
  through `options.edl` or `<buildDir>/edl.json`.
- Normalized clips carry AAC 48 kHz stereo; the speech track formats every input to 48 kHz stereo. `probeAudio`
  (`audio.ts`) reads a file's channels, so a mono provider answer can be panned to both channels at full level
  instead of the -3 dB up-mix `aformat` does.
- ffmpeg facts: `volume=0:enable='between(t,a,b)+…'` mutes windows; `adelay=<ms>:all=1` places a window; `amix
  normalize=0 duration=first` sums without level change, keeping the base's length.
