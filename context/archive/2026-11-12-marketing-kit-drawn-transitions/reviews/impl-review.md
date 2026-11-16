# Implementation review: marketing-kit-drawn-transitions

- Drift: none; the plan's `FRAME_TIMING` decision was added during implementation (a dropped frame found by the
  real ffmpeg tests) and recorded under Decisions.
- Correctness: old transitions draw as before (the full kit suite passes; only the fade tail's new `kind` field and
  the enum's error text changed in existing tests). A drawn transition on a too-short piece plays a plain cut in the
  picture and the draft alike.
- Tests: the filter strings, the validation, the picture and draft plans and arguments, the stutter in the draft and
  both composition paths, and real ffmpeg runs comparing the draft and the picture frame by frame.
- Verdict: approve.
