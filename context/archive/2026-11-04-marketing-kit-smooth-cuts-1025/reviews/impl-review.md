---
change_id: marketing-kit-smooth-cuts-1025
verdict: approved
---

# Implementation review: marketing-kit-smooth-cuts-1025

Reviewed 55fe77b..849212a against plan.md and the "done when" list of #1025.

- Eased punch-in: `getSegmentZoomEases` is the one source for the render's tween and the draft's `zoompan`, so both
  ease over the same frames from the same start scale (punch-out included); clamped to the segment's frames, never on
  the first segment or a `kenburns` one. Tested on the built timeline and the draft graph with `zoomEaseFrames: 4`,
  and the draft graph is run through real ffmpeg. `zoomPercent` takes 112, refuses 113.
- Cut audio: the dip path builds the same graph as before (a test compares the default against the explicit
  default); `cutAudioFadeMs: 40` puts 0.04 at every cut. The crossfade lengthens interior sides by half the fade and
  pads with `adelay`/`apad`, and the WAV check confirms the exact cut length, so speech stays under its picture.
- Auto: `buildEdl` writes plain cuts, `chooseCutTransitions` sets only plain jump cuts, so `whoosh`/hand-set
  transitions and cuts between clips stay; the choice runs only when the cut is built (`cutFootageFilm`), never on a
  read EDL. Synthetic pairs (similar → zoom, different → fade) need no provider; the ffmpeg test covers the whole step
  and `cuts.json`.
- Compatibility: `cutFootage` keeps its sync signature; every new option is optional with today's default;
  `FootageTransitions.jump` only widens. The config defaults and the JSON Schema are regenerated and tested.
- Approved.
