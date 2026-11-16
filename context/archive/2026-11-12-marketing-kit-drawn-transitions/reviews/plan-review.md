# Plan review: marketing-kit-drawn-transitions

- Backward compatibility (Critical, accepted): new enum values only; every existing filter, markup and test stays as
  it is for the old transitions (the overlap helper returns the fade's frames unchanged).
- Draft and render alike (Critical, accepted): one builder, real ffmpeg tests on both paths compare the frames at the
  same index (the draft at the picture's size).
- Render cost on a shared server (Warning, accepted): the paper's `blend` costs about 8 s at 1080x1920; at most one
  paper a reel is the app's rule. Recorded in the README.
- A drawn transition into a tighter camera (Warning, accepted): its tail is baked relative to the incoming start as a
  fade's is; the app plans around it.
- Verdict: approve.
