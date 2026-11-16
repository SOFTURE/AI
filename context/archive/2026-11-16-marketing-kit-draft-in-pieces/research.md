# Research: marketing-kit-draft-in-pieces

- `buildFootageDraftArgs` builds one graph: per segment one input (`-ss/-t -i clip`; a split screen three bands and a
  looped PNG), per-segment zoom chain (`buildPictureFilters`), then a left fold of joins: `xfade` at `offset=plan.start`
  for a fade, `buildDrawnJoin` (split at frame `round(start*30)`) for whip/card/paper, `concat` otherwise; captions
  `ass` at the end; sound from the speech/mix inputs.
- Each segment's stream runs `plan.seconds` = its length plus the next segment's overlap, so a transition only reads
  the segment before it. A piece can therefore start its graph one segment early (a "lead") and trim that segment's
  own frames away; everything after the incoming segment's start is drawn exactly as in one run.
- Stutter has no overlap (zoompan on the incoming segment), plain and zoom cuts neither: no lead needed.
- Captions and overlays are timed on film time: burned in once over the joined film (concat demuxer + `ass`).
- Memory measured locally (720x1280 testsrc, ffmpeg 6.1, ru_maxrss per run): pieces of 4 segments 166-193 MB for 51,
  150 and 400 cuts alike; the speech step with audio sources 197 MB at 400 cuts (one input per segment, audio only).
  One run grows with every decoder.
- Server calibration for the estimate: 18 cuts of 1080x1920 sources peaked 1.50 GB (`250 + 18 x 70` = 1510 MB).
