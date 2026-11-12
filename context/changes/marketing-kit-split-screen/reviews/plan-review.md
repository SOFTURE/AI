# Plan review: marketing-kit-split-screen

- Backward compatibility (Critical, accepted): a new optional field; an EDL without it builds the same arguments
  (the draft's inputs keep their indices, the picture's tail stays at `[1:v]`); the existing kit suite must pass.
- Draft and render alike (Critical, accepted): one builder and one layer, a real ffmpeg test compares both paths.
- Frame count (Warning, accepted): the overlay's frames carry no duration; the output is renumbered before `fps`.
- Captions on the labels (Warning, accepted): checked with caption bounds; an app that edits through `validateEdl`
  with bounds gets the refusal and the box to use.
- Verdict: approve.
