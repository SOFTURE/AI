# Implementation review: marketing-kit-split-screen

- Drift: none; the frame renumbering (`setpts=N`) was found by the real ffmpeg test and recorded in research.
- Correctness: the kit suite passes unchanged for EDLs without a split; a split's draft and picture match frame by
  frame; fades and drawn transitions into a split read their tail from the input after the split's four.
- Tests: 25 new, covering every refusal message, the layer, the filters and both paths' arguments.
- Verdict: approve.
