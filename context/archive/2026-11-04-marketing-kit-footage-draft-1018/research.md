---
change_id: marketing-kit-footage-draft-1018
---

# Research

Sources: `tools/marketing-kit/src/footage/` on master (1cff7da), PR #1019 (per-input seek of the cut preview),
ffmpeg 6.1 in this container, the CI ffmpeg (static 6.0 build, libass and libfreetype included).

## How the full render draws the film (`compose.ts`)

- Segments play back to back from `getSegmentStarts(edl)`; the film's cut length is `getEdlDuration(edl)`.
- `fade`: the incoming segment fades in over `fadeFrames / FOOTAGE_FPS` seconds while the outgoing segment plays on
  past its end for that long (its `data-duration` gets the tail). The cut's length does not change.
- `zoom`: `getSegmentScales(edl, zoomPercent)` gives each segment a static `transform: scale(s)` centred on the frame.
- `kenburns`: the scale tweens from the segment's scale to `scale * (1 + kenBurnsPercent/100)` (4 % when the film's
  percent is 0) over the segment's length.
- Captions: `phraseChunks(words)` (or `captionChunks` for the highlight pill), each shown from `start - 0.05` to
  `min(end + 0.35, next.start - 0.06)` (the cut's end for the last), white bold text with a dark shadow, centred in
  the caption box (`top`, `left`, `right`, `fontSize`) of the layout, which the 9:16 caption preset replaces
  (`getCaptionPresetLayout`) unless the project overrides the caption box.
- Speech: `buildSpeechArgs(edl, transcript.speech, …)`.

## ffmpeg building blocks (checked with a prototype in this container)

- Per-segment input seek `-ss start -t length -i clip` (as #1019 does for the cut preview) avoids decoding each clip
  from its start.
- Zoom: `crop=iw/s:ih/s` (centred by default) then `scale=W:H`.
- Ken Burns: `zoompan=z='from+(to-from)*on/frames':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=WxH:fps=30`.
- Fade: `xfade=transition=fade:duration=F:offset=<start of the incoming segment>`; the outgoing stream is padded
  (`tpad=stop_mode=clone`) and trimmed to its length plus F, so a clip that ends early still feeds the fade.
- Plain cuts: `concat=n=2:v=1:a=0`.
- Captions: an ASS file with `PlayResX/Y` equal to the full frame, so the layout's pixel values apply as they are and
  libass scales them to the draft's size; `Alignment 8` (top centre) with `MarginL/R/V` from the caption box; smart
  wrapping. `ass=filename=…:fontsdir=…` loads the font from a folder.
- A prototype (3 segments, a fade, a zoom cut, Ken Burns, two captions with Polish letters, 1080x1920 sources,
  540x960 out) ran in 0.9 s on this container and produced exactly the planned 4.5 s (135 frames).
- Filter option values with `:`, `'`, `\` or `,` need two levels of escaping; running ffmpeg with `cwd` set to the
  draft folder and relative names (`captions.ass`, `fonts`) avoids escaping entirely. `runProcess` already has `cwd`.

## Font

- The kit ships no runtime font: `@fontsource/inter` is a dev dependency (WOFF/WOFF2, split subsets).
- DejaVu Sans Bold (Bitstream Vera licence: redistribution allowed, modified versions keep a name without "Bitstream"
  or "Vera") subset to Basic Latin, Latin-1, Latin Extended-A (all Polish letters) and common punctuation is 48 KB.

## Machine check

- `checkFootageTools` lists `-filters`; the draft needs `ass` (libass + libfreetype), `xfade` and `zoompan`.
