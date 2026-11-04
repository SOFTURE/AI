---
change_id: marketing-kit-draft-copy-1051
---

# Research: the final pass and the draft tier's H.264 profile (issue #1051)

## Findings

- `isPublishableVideo` (`src/footage/publish.ts`) requires `codec === "h264" && profile === "High" && yuv420p`.
  `buildFinishArgs` copies the picture when it holds, otherwise encodes with `-profile:v high -preset medium -crf 18`.
  `findFinishProblems` checks the finished film with the same predicate, and `finishFootage` logs
  `finish: re-encoded to H.264 High` when the picture was not copied.
- libx264 `ultrafast` turns off CABAC and B-frames, so x264 signals Constrained Baseline (ffprobe:
  `profile=Constrained Baseline`), as the issue measured on hyperframes 0.8.85's `draft` output.
- Instagram, TikTok and YouTube take H.264 Baseline, Main and High; they transcode every upload, so the High profile
  of the upload changes nothing in what viewers get. Every H.264 decoder in a browser or phone plays all three.
- The other direction (a tier-matched preset when the picture must be re-encoded) does not help the case at hand:
  re-encoding the `ultrafast` film again, even at `ultrafast`, still costs a full encode (about 60 s here) and a
  second generation loss, and `finishFootage` does not know the tier.

## Options

1. Treat H.264 yuv420p in Constrained Baseline, Main or High as publishable. One predicate; the draft film is copied;
   `findFinishProblems` accepts it. Recommended.
2. Keep High only and pass the tier's preset into the final pass. Still a second encode; more wiring.

## Decision

Option 1. Plain `Baseline` (ASO/FMO, which x264 never writes) and High 10 / 4:2:2 profiles stay outside: they are
not what every platform decoder takes.
